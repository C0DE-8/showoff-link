const express = require('express');
const { protect } = require('./auth');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();

const JWT_SECRET = 'your_super_secure_jwt_secret_key_12345ghibs2567rjfhrfhhw';

router.post('/upload-note', protect(), async (req, res) => {
  const pool = req.app.get('pool');
  let connection;
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
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Handle optional recipient resolution logic
    let recipientId = null;
    if (recipient_tagname && recipient_tagname.trim() !== "") {
      // FIX: Strip '@' symbol if they typed it, and lowercase the input
      const cleanTag = recipient_tagname.replace(/^@/, '').toLowerCase().trim();

      // FIX: Use LOWER(tagname) so it matches regardless of capital letters in the database
      const [recipientRows] = await connection.query('SELECT id FROM users WHERE LOWER(tagname) = ?', [cleanTag]);

      if (recipientRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(444).json({ error: `No active profile found matching tagname @${recipient_tagname.replace(/^@/, '')}` });
      }
      recipientId = recipientRows[0].id;

      if (recipientId === userId) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: 'You cannot target yourself as the restricted recipient.' });
      }
    }

    // Verification: Balance validation check
    const [userWalletRows] = await connection.query('SELECT tokens FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (userWalletRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'User wallet record not found.' });
    }

    const currentBalance = userWalletRows[0].tokens;
    if (currentBalance < TOKEN_COST) {
      await connection.rollback();
      connection.release();
      return res.status(402).json({ error: `Insufficient funds. Cost is ${TOKEN_COST} tokens. Balance: ${currentBalance}` });
    }

    // Look up if the creator currently has an active background skin equipped
    const [equippedSkinRows] = await connection.query(
      'SELECT skin_id FROM user_skins WHERE user_id = ? AND is_equipped = true',
      [userId]
    );
    const activeSkinId = equippedSkinRows.length > 0 ? equippedSkinRows[0].skin_id : null;

    // Execution: Atomically deduct token assets from user profile cell rows
    await connection.query('UPDATE users SET tokens = tokens - ? WHERE id = ?', [TOKEN_COST, userId]);

    // Insertion: Mount structural text note payload along with the auto-detected skin reference
    const insertQuery = `
      INSERT INTO text_notes (id, note_content, allowed_views, user_id, recipient_id, skin_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const noteId = crypto.randomUUID();
    await connection.query(insertQuery, [noteId, note_content, allowedViews, userId, recipientId, activeSkinId]);

    // Commit adjustments down permanently
    await connection.commit();
    connection.release();

    // Build unique tracking viewer path reference
    const shareableUrl = `file:///C:/Users/hp/Documents/showoff-links/frontend/public/noteView.html?viewId=${noteId}`;

    return res.json({ success: true, id: noteId, shareableUrl });

  } catch (err) {
    if (connection) {
      await connection.rollback().catch(() => {});
      connection.release();
    }
    console.error(err);
    return res.status(500).json({ error: 'Data pipeline processing failure.', details: err.message });
  }
});
// Make sure to import jwt at the top of your file if it isn't already:
// const jwt = require('jsonwebtoken');

router.get('/read-note/:id', async (req, res) => {
  const pool = req.app.get('pool');
  const noteId = req.params.id;

  // Extract authentication header context
  let currentUserTagname = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];

      // 1. Verify the token using your JWT secret (make sure this matches your .env file)
      const decoded = jwt.verify(token, JWT_SECRET);

      // 2. Try to get the tagname directly from the token payload
      currentUserTagname = decoded.tagname;

      // 3. Fallback: If the token only has the user's ID, fetch the tagname from the DB
      if (!currentUserTagname && decoded.id) {
        const [userCheckRows] = await pool.query('SELECT tagname FROM users WHERE id = ?', [decoded.id]);
        if (userCheckRows.length > 0) {
          currentUserTagname = userCheckRows[0].tagname;
        }
      }

    } catch (e) {
      console.error('JWT Decode Error:', e.message);
      // Allow verification anomalies to simply fall back as anonymous viewers
    }
  }

  try {
    // 4. Add the JOIN to the users table to fetch the intended recipient's tagname
    const query = `
      SELECT 
        tn.note_content, 
        tn.allowed_views, 
        tn.current_views, 
        tn.recipient_id,
        u.tagname AS intended_recipient_tagname,
        ps.image_data AS skin_buffer
      FROM text_notes tn
      LEFT JOIN user_skins us ON tn.skin_id = us.skin_id
      LEFT JOIN platform_skins ps ON us.skin_id = ps.id
      LEFT JOIN users u ON tn.recipient_id = u.id
      WHERE tn.id = ?
    `;

    const [rows] = await pool.query(query, [noteId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Purged or non-existent.' });

    const row = rows[0];

    // ==========================================
    // DEBUGGING LOGS
    // ==========================================
    console.log('--- DEBUG INFO ---');
    console.log('Note ID:', noteId);
    console.log('Intended Recipient (DB):', row.intended_recipient_tagname);
    console.log('Current Viewer (Token):', currentUserTagname);
    console.log('------------------');

    // Identity Verification Rule
    if (row.recipient_id !== null) {
      if (row.intended_recipient_tagname !== currentUserTagname) {
        return res.status(403).json({ error: 'Access denied. You are not the authorized reader of this text container.' });
      }
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
    await pool.query('UPDATE text_notes SET current_views = current_views + 1 WHERE id = ?', [noteId]);

    // Direct JSON response payload dispatching down text-channel streams
    return res.json({
      note_content: row.note_content,
      allowed_views: row.allowed_views,
      current_views: row.current_views + 1,
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
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [updateResult] = await connection.query(
      'UPDATE text_notes SET current_views = current_views + 1 WHERE id = ?',
      [noteId]
    );

    if (updateResult.affectedRows > 0) {
      const [stateRows] = await connection.query(
        'SELECT current_views, allowed_views FROM text_notes WHERE id = ?',
        [noteId]
      );
      const state = stateRows[0];
      // Hard data elimination layer executes the moment usage thresholds trip
      if (state.current_views >= state.allowed_views) {
        await connection.query('DELETE FROM text_notes WHERE id = ?', [noteId]);
        console.log(`Purged secure text note ID ${noteId} completely from database records.`);
      }
    }
    await connection.commit();
    connection.release();
    res.json({ success: true });
  } catch (err) {
    if (connection) {
      await connection.rollback().catch(() => {});
      connection.release();
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports =router