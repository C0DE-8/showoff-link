const express = require('express');
const multer = require('multer');
const { protect } = require('./auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });


router.post('/upload-voice', protect(), upload.single('audio'), async (req, res) => {
  const pool = req.app.get('pool');
  const userId = req.user.id; 
  const TOKEN_COST = 2;

  let allowedPlays = parseInt(req.body.allowed_plays, 10) || 1;
  if (allowedPlays > 20) return res.status(400).json({ error: 'Maximum play ceiling cannot exceed 20 views.' });
  if (allowedPlays < 1) allowedPlays = 1;

  const recipientTagname = req.body.recipient_tagname;

  try {
    if (!req.file) return res.status(400).json({ error: 'No audio chunks captured.' });

    await pool.query('BEGIN');

    let recipientId = null;
    if (recipientTagname && recipientTagname.trim() !== "") {
      const cleanTag = recipientTagname.toLowerCase().trim();
      const recipientRes = await pool.query('SELECT id FROM users WHERE tagname = $1', [cleanTag]);
      
      if (recipientRes.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(444).json({ error: `No active profile found matching tagname @${recipientTagname}` });
      }
      recipientId = recipientRes.rows[0].id;

      if (recipientId === userId) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'You cannot target yourself as the restricted recipient.' });
      }
    }

    const userWalletRes = await pool.query('SELECT tokens FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (userWalletRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'User wallet record not found.' });
    }

    const currentBalance = userWalletRes.rows[0].tokens;
    if (currentBalance < TOKEN_COST) {
      await pool.query('ROLLBACK');
      return res.status(402).json({ error: `Insufficient funds.` });
    }

    const equippedSkinRes = await pool.query(
      'SELECT skin_id FROM user_skins WHERE user_id = $1 AND is_equipped = true',
      [userId]
    );
    const activeSkinId = equippedSkinRes.rows.length > 0 ? equippedSkinRes.rows[0].skin_id : null;

    await pool.query('UPDATE users SET tokens = tokens - $1 WHERE id = $2', [TOKEN_COST, userId]);

    // Insert remains exactly the same, but the database now inserts a UUID instead of a sequential integer
    const insertQuery = `
      INSERT INTO voice_notes (audio_data, allowed_plays, user_id, recipient_id, skin_id) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING id
    `;
    const result = await pool.query(insertQuery, [req.file.buffer, allowedPlays, userId, recipientId, activeSkinId]);
    
    await pool.query('COMMIT');

    // This shareableUrl will now safely output: voiceView.html?viewId=d3b07384-d113-4956-a5cc-484014174000
    const shareableUrl =
`http://localhost:8158/voiceView.html?viewId=${result.rows[0].id}`;
    return res.json({ success: true, shareableUrl });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Data pipeline processing failure.', details: err.message });
  }
});


router.get('/stream-voice/:id', async (req, res) => {
  const pool = req.app.get('pool');
  const audioId = req.params.id;

  let currentUserId = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      // jwt verification logic if needed
    } catch (e) {
      currentUserId = null;
    }
  }

  try {
    // Double JOIN to reach platform_skins through user_skins
    const query = `
      SELECT 
        vn.audio_data, 
        vn.allowed_plays, 
        vn.current_plays, 
        vn.recipient_id,
        ps.image_data AS skin_buffer
      FROM voice_notes vn
      LEFT JOIN user_skins us ON vn.skin_id = us.skin_id
      LEFT JOIN platform_skins ps ON us.skin_id = ps.id
      WHERE vn.id = $1
    `;

    const result = await pool.query(query, [audioId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Purged or non-existent.' });
    }

    const row = result.rows[0];

    // Privacy Enforcement
    if (row.recipient_id !== null && row.recipient_id !== currentUserId) {
      return res.status(403).json({ error: 'Access denied. This voice note was not intended for your account.' });
    }

    // Playback Cap Verification
    if (row.current_plays >= row.allowed_plays) {
      return res.status(410).json({ error: 'This audio has already self-destructed.' });
    }

    // Convert bytea Buffer from platform_skins to base64 Data URL string
    let skinImageHeader = '';
    if (row.skin_buffer) {
      const base64Data = Buffer.from(row.skin_buffer).toString('base64');
      skinImageHeader = `data:image/jpeg;base64,${base64Data}`;
    }

    const audioBuffer = row.audio_data;
    const totalSize = audioBuffer.length;
    const range = req.headers.range;

    const baseHeaders = {
      'Content-Type': 'audio/webm',
      'X-Skin-Image': skinImageHeader,
      'Access-Control-Expose-Headers': 'X-Skin-Image, Content-Range, Accept-Ranges'
    };

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunk = audioBuffer.slice(start, end + 1);

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
    console.error(err);
    res.status(500).json({ error: 'Streaming channel broken.' });
  }
});



// WIPE ENDPOINT AFTER USAGE LIMIT CONSUMPTION
router.post('/register-play/:id', async (req, res) => {
  const pool = req.app.get('pool');
  const audioId = req.params.id;

  try {
    const updateRes = await pool.query(
      'UPDATE voice_notes SET current_plays = current_plays + 1 WHERE id = $1 RETURNING current_plays, allowed_plays',
      [audioId]
    );

    if (updateRes.rows.length > 0) {
      const state = updateRes.rows[0];
      if (state.current_plays >= state.allowed_plays) {
        await pool.query('DELETE FROM voice_notes WHERE id = $1', [audioId]);
        console.log(`Purged voice note ID ${audioId} from storage database.`);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { audioRouter: router };
