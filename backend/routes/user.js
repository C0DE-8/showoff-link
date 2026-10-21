const express = require('express');
const { protect } = require('./auth'); // Secure using your factory function middleware
const router = express.Router();
const bcrypt =require("bcrypt")

// GET /api/user/profile — return the signed-in user's profile and token balance.
router.get('/profile', protect(), async (req, res) => {
  const pool = req.app.get('pool');
  const userId = req.user.id;

  try {
    const result = await pool.query(
      'SELECT id, full_name, email, tagname, tokens, role FROM users WHERE id = ?',
      [userId]
    );
    const [rows] = result;
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    
    return res.json({ success: true, profile: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve profile records.' });
  }
});

// GET /api/user/links — list the signed-in user's shared content and view counts.
router.get('/links', protect(), async (req, res) => {
  const pool = req.app.get('pool');
  const userId = req.user.id;

  try {
    const [links] = await pool.query(`
      SELECT * FROM (
        SELECT
          tn.id,
          'note' AS content_type,
          LEFT(tn.note_content, 160) AS label,
          tn.allowed_views AS views_allowed,
          tn.current_views AS views_used,
          GREATEST(tn.allowed_views - tn.current_views, 0) AS views_remaining,
          recipient.tagname AS recipient_tagname,
          tn.created_at,
          (tn.current_views < tn.allowed_views) AS is_active
        FROM text_notes tn
        LEFT JOIN users recipient ON recipient.id = tn.recipient_id
        WHERE tn.user_id = ?

        UNION ALL

        SELECT
          i.id,
          'image' AS content_type,
          i.file_name AS label,
          NULL AS views_allowed,
          NULL AS views_used,
          i.allowed_views AS views_remaining,
          recipient.tagname AS recipient_tagname,
          i.created_at,
          (i.allowed_views > 0) AS is_active
        FROM images i
        LEFT JOIN users recipient ON recipient.id = i.recipient_id
        WHERE i.user_id = ?

        UNION ALL

        SELECT
          vn.id,
          'voice' AS content_type,
          'Voice note' AS label,
          vn.allowed_plays AS views_allowed,
          vn.current_plays AS views_used,
          GREATEST(vn.allowed_plays - vn.current_plays, 0) AS views_remaining,
          recipient.tagname AS recipient_tagname,
          vn.created_at,
          (vn.current_plays < vn.allowed_plays) AS is_active
        FROM voice_notes vn
        LEFT JOIN users recipient ON recipient.id = vn.recipient_id
        WHERE vn.user_id = ?
      ) AS user_links
      ORDER BY created_at DESC
      LIMIT 200
    `, [userId, userId, userId]);

    return res.json({ success: true, links });
  } catch (err) {
    console.error('User link history failed:', err);
    return res.status(500).json({ error: 'Unable to load your shared links.' });
  }
});

// PUT /api/user/update-tagname — change the signed-in user's public tagname.
router.put('/update-tagname', protect(), async (req, res) => {
  const pool = req.app.get('pool');
  const userId = req.user.id;
  const { new_tagname } = req.body;

  if (!new_tagname || new_tagname.trim() === "") {
    return res.status(400).json({ error: 'New tagname cannot be empty.' });
  }

  const tagnameRegex = /^[a-zA-Z0-9_]+$/;
  if (!tagnameRegex.test(new_tagname)) {
    return res.status(400).json({ error: 'Tagname can only contain letters, numbers, and underscores.' });
  }

  try {
    const updateQuery = `
      UPDATE users 
      SET tagname = ?
      WHERE id = ?
    `;
    await pool.query(updateQuery, [new_tagname.toLowerCase().trim(), userId]);
    const [rows] = await pool.query('SELECT id, tagname FROM users WHERE id = ?', [userId]);
    return res.json({ success: true, message: 'Tagname updated successfully.', tagname: rows[0].tagname });
    
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'This tagname is already taken.' });
    return res.status(500).json({ error: 'Failed to update tagname configuration.' });
  }
});

// POST /api/user/gift-tokens — transfer tokens to another user.
router.post('/gift-tokens', protect(), async (req, res) => {
  const pool = req.app.get('pool');
  const senderId = req.user.id;
  const { recipient_tagname, amount_to_gift, confirm_password } = req.body;
  
  const giftAmount = parseInt(amount_to_gift, 10);

  // 1. Initial Validation
  if (!confirm_password) {
    return res.status(400).json({ error: 'Password confirmation is required to authorize transactions.' });
  }

  if (!recipient_tagname || !giftAmount || giftAmount <= 0) {
    return res.status(400).json({ error: 'Valid recipient tagname and positive token volume required.' });
  }

  let connection;
  try {
    // Start an atomic isolation transaction block
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 2. Fetch sender details including password_hash for authorization verification
    const [senderRows] = await connection.query(
      'SELECT tokens, tagname, password_hash FROM users WHERE id = ? FOR UPDATE',
      [senderId]
    );
    const sender = senderRows[0];

    // 3. Verify security credentials before mutating state parameters
    const isPasswordMatch = await bcrypt.compare(confirm_password, sender.password_hash);
    if (!isPasswordMatch) {
      await connection.rollback();
      return res.status(401).json({ error: 'Security authorization failed. Incorrect password.' });
    }

    // 4. Validate asset balance checks
    if (sender.tokens < giftAmount) {
      await connection.rollback();
      return res.status(400).json({ error: `Insufficient token balance. You only have ${sender.tokens} tokens.` });
    }

    // 5. Prevent self-gifting loops
    const cleanRecipientTag = recipient_tagname.toLowerCase().trim();
    if (sender.tagname === cleanRecipientTag) {
      await connection.rollback();
      return res.status(400).json({ error: 'You cannot send gift credits to your own tagname configuration.' });
    }

    // 6. Verify and lock the target recipient record row
    const [recipientRows] = await connection.query('SELECT id FROM users WHERE tagname = ? FOR UPDATE', [cleanRecipientTag]);
    if (recipientRows.length === 0) {
      await connection.rollback();
      return res.status(444).json({ error: `No active profile assigned to tagname handle "${recipient_tagname}".` });
    }
    const recipientId = recipientRows[0].id;

    // 7. Atomic balance balance operations execution
    await connection.query('UPDATE users SET tokens = tokens - ? WHERE id = ?', [giftAmount, senderId]);
    await connection.query('UPDATE users SET tokens = tokens + ? WHERE id = ?', [giftAmount, recipientId]);

    // Commit adjustments down permanently
    await connection.commit();
    return res.json({ success: true, message: `Successfully transferred ${giftAmount} tokens directly to @${cleanRecipientTag}.` });

  } catch (err) {
    if (connection) await connection.rollback();
    console.error(err);
    return res.status(500).json({ error: 'Transaction pipeline crashed processing peer credit.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router
