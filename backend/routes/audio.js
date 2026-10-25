const express = require('express');
const multer = require('multer');
const { protect } = require('./auth');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const JWT_SECRET = 'your_super_secure_jwt_secret_key_12345ghibs2567rjfhrfhhw';
const { getPublicSiteUrl } = require('../site-origin');

function detectAudioMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return 'application/octet-stream';
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'audio/webm';
  if (buffer.toString('ascii', 4, 8) === 'ftyp') return 'audio/mp4';
  if (buffer.toString('ascii', 0, 4) === 'OggS') return 'audio/ogg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') return 'audio/wav';
  if (buffer.toString('ascii', 0, 3) === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  return 'application/octet-stream';
}

// GET /api/audio/preview/:id — owner-only preview that does not use a play.
router.get('/preview/:id', protect(), async (req, res) => {
  try {
    const [rows] = await req.app.get('pool').query(
      'SELECT audio_data FROM voice_notes WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'This recording is unavailable.' });
    const audioBuffer = rows[0].audio_data;
    if (!audioBuffer?.length) return res.status(404).json({ error: 'This recording is empty.' });
    res.set({ 'Content-Type': detectAudioMime(audioBuffer), 'Content-Length': audioBuffer.length, 'Cache-Control': 'private, no-store' });
    return res.send(audioBuffer);
  } catch (error) {
    console.error('Voice preview failed:', error);
    return res.status(500).json({ error: 'Could not load this voice preview.' });
  }
});
 
// POST /api/audio/upload-voice — upload a voice note and charge its token cost.
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

    const shareableUrl = `${getPublicSiteUrl(req)}/voice/${encodeURIComponent(voiceNoteId)}`;
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

// GET /api/audio/stream-voice/:id — stream an available voice note.
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
        ps.image_data AS skin_buffer,
        ps.mime_type AS skin_mime_type
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

    const range = req.headers.range;
    const audioBuffer = row.audio_data;
    const totalSize = audioBuffer.length;

    if (!totalSize) return res.status(404).json({ error: 'This voice recording is empty.' });

    // Count a listen only when playback starts at the beginning. Browsers make
    // additional byte-range requests for the same listen while buffering/seeking;
    // those must remain available even when the play limit has just been reached.
    const isInitialRequest = !range || range.startsWith('bytes=0-');
    if (isInitialRequest) {
      if (row.current_plays >= row.allowed_plays) {
        return res.status(410).json({ error: 'This audio has already self-destructed.' });
      }

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
      skinImageHeader = `data:${row.skin_mime_type || 'image/jpeg'};base64,${base64Data}`;
    }

    const baseHeaders = {
      'Content-Type': detectAudioMime(audioBuffer),
      'Accept-Ranges': 'bytes',
      'X-Skin-Image': skinImageHeader,
      'Access-Control-Expose-Headers': 'X-Skin-Image, Content-Range, Accept-Ranges, Content-Length'
    };

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        return res.status(416).set('Content-Range', `bytes */${totalSize}`).end();
      }
      let start = match[1] ? Number(match[1]) : Math.max(0, totalSize - Number(match[2]));
      let end = match[2] && match[1] ? Number(match[2]) : totalSize - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= totalSize || start > end) {
        return res.status(416).set('Content-Range', `bytes */${totalSize}`).end();
      }
      end = Math.min(end, totalSize - 1);
      const chunk = audioBuffer.subarray(start, end + 1);

      res.writeHead(206, {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': chunk.length
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
// POST /api/audio/register-play/:id — record a voice note play and enforce view limits.
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
