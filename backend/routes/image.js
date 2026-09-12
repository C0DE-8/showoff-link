const express = require('express');
const multer = require('multer');
const { protect } = require('./auth');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
// Configure Multer to store files directly in a local folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Generate a secure, unique filename to avoid naming collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// 1. UPLOAD ROUTE
router.post('/upload-asset', protect(), upload.single('graphicAsset'), async (req, res) => {
  console.log("=== INCOMING IMAGE UPLOAD PIPELINE ===");
  
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

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No graphic asset chunks captured.' });
    }

    await pool.query('BEGIN');

    // Handle optional recipient resolution
    let recipientId = null;
    if (recipientTagname && recipientTagname.trim() !== "") {
      const cleanTag = recipientTagname.toLowerCase().trim();
      const recipientRes = await pool.query('SELECT id FROM users WHERE tagname = $1', [cleanTag]);
      
      if (recipientRes.rows.length === 0) {
        await pool.query('ROLLBACK');
        fs.unlinkSync(req.file.path);
        return res.status(444).json({ error: `No active profile found matching tagname @${recipientTagname}` });
      }
      recipientId = recipientRes.rows[0].id;

      if (recipientId === userId) {
        await pool.query('ROLLBACK');
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'You cannot target yourself as the restricted recipient.' });
      }
    }

    // Balance verification
    const userWalletRes = await pool.query('SELECT tokens FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (userWalletRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'User wallet record not found.' });
    }

    const currentBalance = userWalletRes.rows[0].tokens;
    if (currentBalance < TOKEN_COST) {
      await pool.query('ROLLBACK');
      fs.unlinkSync(req.file.path);
      return res.status(402).json({ error: `Insufficient funds. Balance: ${currentBalance}` });
    }

    // Deduct Tokens
    await pool.query('UPDATE users SET tokens = tokens - $1 WHERE id = $2', [TOKEN_COST, userId]);

    // Save the LOCAL FILE PATH string instead of raw data blob
    const insertQuery = `
      INSERT INTO images (image_path, file_name, allowed_views, user_id, recipient_id) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING id
    `;
    const result = await pool.query(insertQuery, [
      req.file.path, // relative path (e.g., "uploads/172000000-12345.png")
      req.file.originalname, 
      allowedViews, 
      userId, 
      recipientId
    ]);

    await pool.query('COMMIT');

    // FIX: Point the shared link to the HTML UI view, NOT the raw api data block!
    const shareableUrl =
`http://localhost:8158/view-asset.html?id=${result.rows[0].id}`;
    return res.json({ success: true, shareableUrl, id: result.rows[0].id });

  } catch (err) {
    await pool.query('ROLLBACK');
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error(err); 
    return res.status(500).json({ error: 'Data pipeline processing failure.', details: err.message });
  }
});

// 2. DATA DECRYPTION PIPELINE (Used by frontend viewAsset.js to fetch the image)
/* =========================================================================
   SINGLE-VIEW DECRYPTION STREAM ROUTE
   ========================================================================= */
/* =========================================================================
   SINGLE-VIEW DECRYPTION STREAM ROUTE (Complete Block)
   ========================================================================= */
router.get('/view-asset/:id', async (req, res) => {
  const pool = req.app.get('pool');
  const imageId = req.params.id;

  // Setup your base absolute path dynamically from this route location
  // Adjust the '..' to match your exact directory level if this file is heavily nested
  const uploadsDir = path.join(__dirname, '..', 'uploads');

  let currentUserId = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      // Optional: Add manual jsonwebtoken decoding logic here if validating users
    } catch (e) {}
  }

  try {
    const result = await pool.query(
      'SELECT image_path, file_name, allowed_views, recipient_id FROM images WHERE id = $1', 
      [imageId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset missing or already self-destructed.' });
    }

    const imageRecord = result.rows[0];

    // Identity access control check
    if (imageRecord.recipient_id !== null && imageRecord.recipient_id !== currentUserId) {
      return res.status(403).json({ error: 'Access denied. You are not the authorized reader of this asset.' });
    }

    // FIX: Clean up path string if the DB stored the "uploads/" directory prefix prefixing the filename
    let cleanFileName = imageRecord.image_path;
    if (cleanFileName.startsWith('uploads/')) {
      cleanFileName = cleanFileName.replace('uploads/', '');
    }

    // Resolve the absolute file location targeting the local disk folder storage system
    const targetFilePath = path.join(uploadsDir, cleanFileName);

    // Structural verification safeguard check
    if (!fs.existsSync(targetFilePath)) {
      console.error(`File asset missing from disk architecture lookup target: ${targetFilePath}`);
      return res.status(404).json({ error: 'Asset structural data file missing from backend nodes.' });
    }

    // Decrement counter or purge metadata record if final view session initialized
    if (imageRecord.allowed_views <= 1) {
      await pool.query('DELETE FROM images WHERE id = $1', [imageId]);
      
      // Hook network buffer closure before wiping payload fragments permanently off disk
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
      await pool.query('UPDATE images SET allowed_views = allowed_views - 1 WHERE id = $1', [imageId]);
    }

    // Safely send the file payload downstream
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
    await pool.query('DELETE FROM images WHERE id = $1', [imageId]);
    return res.json({ success: true, message: 'Asset wiped from registration arrays.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to execute structural wipe sequence.' });
  }
});

module.exports = router;