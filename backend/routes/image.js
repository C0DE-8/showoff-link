const express = require('express');
const multer = require('multer');
const { protect } = require('./auth');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const path = require('path');
const fs = require('fs');


const JWT_PAYLOAD = 'your_super_secure_jwt_secret_key_12345ghibs2567rjfhrfhhw';
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://showoff-link.vercel.app').replace(/\/$/, '');
const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },

  filename: (req, file, cb) => {
    const uniqueSuffix =
      Date.now() + '-' + Math.round(Math.random() * 1E9);

    cb(
      null,
      uniqueSuffix + path.extname(file.originalname)
    );
  }
});

const upload = multer({
  storage: storage
});


// 1. UPLOAD ROUTE
router.post('/upload-asset', protect(), upload.single('graphicAsset'), async (req, res) => {

  
  const pool = req.app.get('pool');
  const userId = req.user ? req.user.id : null; 
  const TOKEN_COST = 2;

  let allowedViews = parseInt(req.body.allowed_views, 10) || 5; 
  if (allowedViews > 20) {
    if (req.file) fs.unlinkSync(req.file.path); // Clean up uploaded file on failure
    return res.status(400).json({ error: 'Maximum viewing ceiling cannot exceed 20 views.' });
  }
  if (allowedViews < 1) allowedViews = 1;

  const recipientTagname = req.body.recipient_tagname;
  let connection;
  let transactionStarted = false;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No graphic asset chunks captured.' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // Handle optional recipient resolution
    let recipientId = null;
    if (recipientTagname && recipientTagname.trim() !== "") {
      const cleanTag = recipientTagname.toLowerCase().trim();
      const [recipientRows] = await connection.query('SELECT id FROM users WHERE tagname = ?', [cleanTag]);
      
      if (recipientRows.length === 0) {
        await connection.rollback();
        transactionStarted = false;
        fs.unlinkSync(req.file.path);
        return res.status(444).json({ error: `No active profile found matching tagname @${recipientTagname}` });
      }
      recipientId = recipientRows[0].id;

      if (recipientId === userId) {
        await connection.rollback();
        transactionStarted = false;
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'You cannot target yourself as the restricted recipient.' });
      }
    }

    // Balance verification
    const [userWalletRows] = await connection.query('SELECT tokens FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (userWalletRows.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'User wallet record not found.' });
    }

    const currentBalance = userWalletRows[0].tokens;
    if (currentBalance < TOKEN_COST) {
      await connection.rollback();
      transactionStarted = false;
      fs.unlinkSync(req.file.path);
      return res.status(402).json({ error: `Insufficient funds. Balance: ${currentBalance}` });
    }

    // Deduct Tokens
    await connection.query('UPDATE users SET tokens = tokens - ? WHERE id = ?', [TOKEN_COST, userId]);

    // Save the LOCAL FILE PATH string instead of raw data blob
    const insertQuery = `
      INSERT INTO images (id, image_path, file_name, allowed_views, user_id, recipient_id) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const imageId = crypto.randomUUID();
    await connection.query(insertQuery, [
      imageId,
      req.file.path, // relative path (e.g., "uploads/172000000-12345.png")
      req.file.originalname, 
      allowedViews, 
      userId, 
      recipientId
    ]);

    await connection.commit();
    transactionStarted = false;

    const shareableUrl = `${PUBLIC_SITE_URL}/view-asset.html?id=${encodeURIComponent(imageId)}`;
    return res.json({ success: true, shareableUrl, id: imageId });

  } catch (err) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error(err); 
    return res.status(500).json({ error: 'Data pipeline processing failure.', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});



router.get('/view-asset/:id', async (req, res) => {
  const pool = req.app.get('pool');
  const imageId = req.params.id;

  const uploadsDir = path.join(__dirname, '..', 'uploads');

  // 1. Authenticate user via Header or Query Parameter
  let currentUserId = null;
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const JWT_SECRET = JWT_PAYLOAD;
      const decoded = jwt.verify(token, JWT_SECRET);
      currentUserId = decoded.id || decoded.userId || decoded.sub;
    } catch (e) {
      console.warn("Invalid or expired JWT token provided during asset view.");
    }
  }

  try {
    const [imageRows] = await pool.query(
      'SELECT image_path, file_name, allowed_views, recipient_id FROM images WHERE id = ?',
      [imageId]
    );

    if (imageRows.length === 0) {
      return res.status(404).json({ error: 'Asset missing or already self-destructed.' });
    }

    const imageRecord = imageRows[0];

    // 2. Recipient Restriction Check
    if (imageRecord.recipient_id !== null) {
      if (!currentUserId || String(imageRecord.recipient_id) !== String(currentUserId)) {
        return res.status(403).json({ error: 'Access denied. You are not the authorized reader of this asset.' });
      }
    }

    // 3. Fix Path Duplication: Extract ONLY the filename from the stored DB string
    const cleanFileName = path.basename(imageRecord.image_path);

    // Resolve exact local path on disk
    const targetFilePath = path.join(uploadsDir, cleanFileName);

    // Safeguard check
    if (!fs.existsSync(targetFilePath)) {
      console.error(`File asset missing from disk architecture lookup target: ${targetFilePath}`);
      return res.status(404).json({ error: 'Asset structural data file missing from backend nodes.' });
    }

    // 4. Decrement views or purge asset record
    if (imageRecord.allowed_views <= 1) {
      await pool.query('DELETE FROM images WHERE id = ?', [imageId]);
      
      res.on('finish', () => {
        try {
          if (fs.existsSync(targetFilePath)) {
            fs.unlinkSync(targetFilePath);
            console.log(`[PURGE SUCCESS] ${cleanFileName} expunged completely from disk.`);
          }
        } catch (unlinkErr) {
          console.error("Delayed filesystem unlinking error:", unlinkErr);
        }
      });
    } else {
      await pool.query('UPDATE images SET allowed_views = allowed_views - 1 WHERE id = ?', [imageId]);
    }

    // 5. Stream file downstream
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${imageRecord.file_name}"`);
    return res.sendFile(targetFilePath);

  } catch (err) {
    console.error("API View Route Pipeline Failure:", err);
    return res.status(500).json({ error: 'Pipeline structural lookup failure.' });
  }
});

router.delete('/purge-asset/:id', async (req, res) => {
  const pool = req.app.get('pool');
  const imageId = req.params.id;

  try {
    await pool.query('DELETE FROM images WHERE id = ?', [imageId]);
    return res.json({ success: true, message: 'Asset wiped from registration arrays.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to execute structural wipe sequence.' });
  }
});

module.exports = router;
