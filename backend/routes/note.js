const express = require('express');
const { protect } = require('./auth');

const router = express.Router();


router.post('/upload-note', protect(), async (req, res) => {
  const pool = req.app.get('pool');
  const { note_content, allowed_views, recipient_tagname } = req.body;
  const userId = req.user.id; // Decoded dynamically via protect middleware framework
  const TOKEN_COST = 1;

  // Enforce a strict max-view ceiling of 20 views based on user input
  let allowedViews = parseInt(allowed_views, 10) || 1;
  if (allowedViews > 20) {
    return res.status(400).json({ error: 'Maximum viewing ceiling cannot exceed 20 views.' });
  }
  if (allowedViews < 1) allowedViews = 1;

  try {
    if (!note_content || note_content.trim() === "") {
      return res.status(400).json({ error: 'Note content cannot be empty.' });
    }

    // Open an atomic transaction block to protect state mutations
    await pool.query('BEGIN');

    // Handle optional recipient resolution logic
    let recipientId = null;
    if (recipient_tagname && recipient_tagname.trim() !== "") {
      const cleanTag = recipient_tagname.toLowerCase().trim();
      const recipientRes = await pool.query('SELECT id FROM users WHERE tagname = $1', [cleanTag]);
      
      if (recipientRes.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(444).json({ error: `No active profile found matching tagname @${recipient_tagname}` });
      }
      recipientId = recipientRes.rows[0].id;

      if (recipientId === userId) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'You cannot target yourself as the restricted recipient.' });
      }
    }

    // Verification: Balance validation check
    const userWalletRes = await pool.query('SELECT tokens FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (userWalletRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'User wallet record not found.' });
    }

    const currentBalance = userWalletRes.rows[0].tokens;
    if (currentBalance < TOKEN_COST) {
      await pool.query('ROLLBACK');
      return res.status(402).json({ error: `Insufficient funds. Cost is ${TOKEN_COST} tokens. Balance: ${currentBalance}` });
    }

    // Look up if the creator currently has an active background skin equipped
    const equippedSkinRes = await pool.query(
      'SELECT skin_id FROM user_skins WHERE user_id = $1 AND is_equipped = true',
      [userId]
    );
    const activeSkinId = equippedSkinRes.rows.length > 0 ? equippedSkinRes.rows[0].skin_id : null;

    // Execution: Atomically deduct token assets from user profile cell rows
    await pool.query('UPDATE users SET tokens = tokens - $1 WHERE id = $2', [TOKEN_COST, userId]);

    // Insertion: Mount structural text note payload along with the auto-detected skin reference
    const insertQuery = `
      INSERT INTO text_notes (note_content, allowed_views, user_id, recipient_id, skin_id) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING id
    `;
    const result = await pool.query(insertQuery, [note_content, allowedViews, userId, recipientId, activeSkinId]);
    
    // Commit adjustments down permanently
    await pool.query('COMMIT');

    // Build unique tracking viewer path reference
    const shareableUrl =
`http://localhost:8158/noteView.html?viewId=${result.rows[0].id}`;
    return res.json({ success: true, id: result.rows[0].id, shareableUrl });

  } catch (err) {
    await pool.query('ROLLBACK'); // Revert all operations if anything unexpected happens
    console.error(err);
    return res.status(500).json({ error: 'Data pipeline processing failure.', details: err.message });
  }
});

router.get('/read-note/:id', async (req, res) => {
  const pool = req.app.get('pool');
  const noteId = req.params.id;

  // Extract authentication header context manually if it exists
  let currentUserId = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      // Replace with your manual token decoding process matching your protect framework:
      // const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // currentUserId = decoded.id;
    } catch (e) {
      // Allow verification anomalies to simply fall back as anonymous viewers
    }
  }

  try {
    const query = `
      SELECT 
        tn.note_content, 
        tn.allowed_views, 
        tn.current_views, 
        tn.recipient_id,
        ps.image_data AS skin_buffer
      FROM text_notes tn
      LEFT JOIN user_skins us ON tn.skin_id = us.skin_id
      LEFT JOIN platform_skins ps ON us.skin_id = ps.id
      WHERE tn.id = $1
    `;

    const result = await pool.query(query, [noteId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Purged or non-existent.' });

    const row = result.rows[0];

    // Identity Verification Rule: Only enforce matching if a restricted recipient was set
    if (row.recipient_id !== null && row.recipient_id !== currentUserId) {
      return res.status(403).json({ error: 'Access denied. You are not the authorized reader of this note container.' });
    }

    if (row.current_views >= row.allowed_views) {
      return res.status(410).json({ error: 'This note has already self-destructed.' });
    }

    // Convert bytea Buffer from platform_skins to base64 Data URL string
    let skinImage = '';
    if (row.skin_buffer) {
      const base64Data = Buffer.from(row.skin_buffer).toString('base64');
      skinImage = `data:image/jpeg;base64,${base64Data}`;
    }

    // Atomic increment view count execution
    await pool.query('UPDATE text_notes SET current_views = current_views + 1 WHERE id = $1', [noteId]);

    // Direct JSON response payload dispatching down text-channel streams
    return res.json({
      note_content: row.note_content,
      allowed_views: row.allowed_views,
      current_views: row.current_views + 1, // Reflect the view change in response payload
      skin_image: skinImage
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Reading channel interface failure.' });
  }
});


router.post('/register-view/:id', async (req, res) => {
  const pool = req.app.get('pool');
  const noteId = req.params.id;

  try {
    const updateRes = await pool.query(
      'UPDATE text_notes SET current_views = current_views + 1 WHERE id = $1 RETURNING current_views, allowed_views',
      [noteId]
    );

    if (updateRes.rows.length > 0) {
      const state = updateRes.rows[0];
      // Hard data elimination layer executes the moment usage thresholds trip
      if (state.current_views >= state.allowed_views) {
        await pool.query('DELETE FROM text_notes WHERE id = $1', [noteId]);
        console.log(`Purged secure text note ID ${noteId} completely from database records.`);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports =router