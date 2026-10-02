const express = require('express');
const multer = require('multer');
const { protect } = require('./auth');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const JWT_SECRET = 'your_super_secure_jwt_secret_key_12345ghibs2567rjfhrfhhw';

router.post('/upload-voice', protect(), upload.single('audio'), async (req, res) => {
  const pool = req.app.get('pool');
  const userId = req.user.id; 
  const TOKEN_COST = 2;
  let connection;
  let transactionStarted = false;

  let allowedPlays = parseInt(req.body.allowed_plays, 10) || 1;
  if (allowedPlays > 20) return res.status(400).json({ error: 'Maximum play ceiling cannot exceed 20 views.' });
  if (allowedPlays < 1) allowedPlays = 1;

  const recipientTagname = req.body.recipient_tagname;

  try {
    if (!req.file) return res.status(400).json({ error: 'No audio chunks captured.' });

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    let recipientId = null;
    if (recipientTagname && recipientTagname.trim() !== "") {
      const cleanTag = recipientTagname.toLowerCase().trim();
      const [recipientRows] = await connection.query('SELECT id FROM users WHERE tagname = ?', [cleanTag]);
      
      if (recipientRows.length === 0) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(444).json({ error: `No active profile found matching tagname @${recipientTagname}` });
      }
      recipientId = recipientRows[0].id;

      if (recipientId === userId) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(400).json({ error: 'You cannot target yourself as the restricted recipient.' });
      }
    }

    const [userWalletRows] = await connection.query('SELECT tokens FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (userWalletRows.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'User wallet record not found.' });
    }

    const currentBalance = userWalletRows[0].tokens;
    if (currentBalance < TOKEN_COST) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(402).json({ error: `Insufficient funds.` });
    }

    const [equippedSkinRows] = await connection.query(
      'SELECT skin_id FROM user_skins WHERE user_id = ? AND is_equipped = true',
      [userId]
    );
    const activeSkinId = equippedSkinRows.length > 0 ? equippedSkinRows[0].skin_id : null;

    await connection.query('UPDATE users SET tokens = tokens - ? WHERE id = ?', [TOKEN_COST, userId]);

    const insertQuery = `
      INSERT INTO voice_notes (id, audio_data, allowed_plays, user_id, recipient_id, skin_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const voiceNoteId = crypto.randomUUID();
    await connection.query(insertQuery, [voiceNoteId, req.file.buffer, allowedPlays, userId, recipientId, activeSkinId]);
    
    await connection.commit();
    transactionStarted = false;

    // This shareableUrl will now safely output: voiceView.html?viewId=d3b07384-d113-4956-a5cc-484014174000
    const shareableUrl = `file:///C:/Users/hp/Documents/showoff-links/frontend/public/voiceView.html?viewId=${voiceNoteId}`;
    return res.json({ success: true, shareableUrl });

  } catch (err) {
    if (connection && transactionStarted) {
      await connection.rollback().catch(() => {});
    }
    console.error(err);
    return res.status(500).json({ error: 'Data pipeline processing failure.', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get('/stream-voice/:id', async (req, res) => {
  const pool = req.app.get('pool');
  const audioId = req.params.id;

  // Extract authentication token from Header OR Query string
  let currentViewerTagname = null;
  let currentUserId = null;

  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.split(' ')[1]
    : queryToken;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      currentUserId = decoded.id;
      currentViewerTagname = decoded.tagname;

      // Fallback: Fetch tagname from DB if missing in token payload
      if (!currentViewerTagname && currentUserId) {
        const [userCheckRows] = await pool.query('SELECT tagname FROM users WHERE id = ?', [currentUserId]);
        if (userCheckRows.length > 0) {
          currentViewerTagname = userCheckRows[0].tagname;
        }
      }
    } catch (e) {
      console.error('JWT Decode Error:', e.message);
    }
  }

  try {
    const query = `
      SELECT 
        vn.audio_data, 
        vn.allowed_plays, 
        vn.current_plays, 
        vn.recipient_id,
        u.tagname AS intended_recipient_tagname,
        ps.image_data AS skin_buffer
      FROM voice_notes vn
      LEFT JOIN user_skins us ON vn.skin_id = us.skin_id
      LEFT JOIN platform_skins ps ON us.skin_id = ps.id
      LEFT JOIN users u ON vn.recipient_id = u.id
      WHERE vn.id = ?
    `;

    const [rows] = await pool.query(query, [audioId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Purged or non-existent.' });
    }

    const row = rows[0];

    // ==========================================
    // DEBUGGING LOGS
    // ==========================================
    console.log('--- VOICE STREAM DEBUG INFO ---');
    console.log('Voice Note ID:', audioId);
    console.log('Intended Recipient ID (DB):', row.recipient_id);
    console.log('Intended Recipient Tagname (DB):', row.intended_recipient_tagname);
    console.log('Current Viewer ID (Token):', currentUserId);
    console.log('Current Viewer Tagname (Token):', currentViewerTagname);
    console.log('Range Header:', req.headers.range || 'Full Stream (No Range)');
    console.log('-------------------------------');

    // Identity Verification Rule
    if (row.recipient_id !== null) {
      const isAuthorizedById = currentUserId && (row.recipient_id === currentUserId);
      const isAuthorizedByTag = (
        row.intended_recipient_tagname &&
        currentViewerTagname &&
        row.intended_recipient_tagname.toLowerCase().trim() === currentViewerTagname.toLowerCase().trim()
      );

      if (!isAuthorizedById && !isAuthorizedByTag) {
        return res.status(403).json({ error: 'Access denied. This voice note was not intended for your account.' });
      }
    }

    // Early Cap Verification
    if (row.current_plays >= row.allowed_plays) {
      return res.status(410).json({ error: 'This audio has already self-destructed.' });
    }

    const range = req.headers.range;
    const audioBuffer = row.audio_data;
    const totalSize = audioBuffer.length;

    // Atomic Play Count Increment (Triggered only on stream initialization, not range seeks)
    const isInitialRequest = !range || range.startsWith('bytes=0-');
    if (isInitialRequest) {
      const [updateResult] = await pool.query(
        `UPDATE voice_notes
         SET current_plays = current_plays + 1
         WHERE id = ? AND current_plays < allowed_plays`,
        [audioId]
      );

      if (updateResult.affectedRows === 0) {
        return res.status(410).json({ error: 'This audio has already self-destructed.' });
      }
    }

    // Convert bytea Buffer from platform_skins to base64 Data URL string
    let skinImageHeader = '';
    if (row.skin_buffer) {
      const base64Data = Buffer.from(row.skin_buffer).toString('base64');
      skinImageHeader = `data:image/jpeg;base64,${base64Data}`;
    }

    const baseHeaders = {
      'Content-Type': 'audio/webm',
      'X-Skin-Image': skinImageHeader,
      'Access-Control-Expose-Headers': 'X-Skin-Image, Content-Range, Accept-Ranges'
    };

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunk = audioBuffer.subarray(start, end + 1);

      res.writeHead(206, {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': (end - start) + 1
      });
      res.end(chunk);
    } else {
      res.writeHead(200, {
        ...baseHeaders,
        'Content-Length': totalSize
      });
      res.end(audioBuffer);
    }
  } catch (err) {
    console.error('Voice Stream Error:', err);
    res.status(500).json({ error: 'Streaming channel broken.' });
  }
});

// WIPE ENDPOINT AFTER USAGE LIMIT CONSUMPTION
router.post('/register-play/:id', async (req, res) => {
  const pool = req.app.get('pool');
  const audioId = req.params.id;

  try {
    const [updateRes] = await pool.query(
      'UPDATE voice_notes SET current_plays = current_plays + 1 WHERE id = ?',
      [audioId]
    );

    if (updateRes.affectedRows > 0) {
      const [stateRows] = await pool.query(
        'SELECT current_plays, allowed_plays FROM voice_notes WHERE id = ?',
        [audioId]
      );
      const state = stateRows[0];
      if (state.current_plays >= state.allowed_plays) {
        await pool.query('DELETE FROM voice_notes WHERE id = ?', [audioId]);
        console.log(`Purged voice note ID ${audioId} from storage database.`);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { audioRouter: router };
