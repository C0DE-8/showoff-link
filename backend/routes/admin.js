const express = require('express');
const { protect } = require('./auth');
const multer = require('multer');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Replace your entire diskStorage setup with this:
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


router.post('/admin/upload-skin', protect(), upload.single('skinGraphic'), async (req, res) => {
  const pool = req.app.get('pool');
  const userId = req.user.id;
  const { name, token_cost } = req.body;

  try {
    // 1. Verify Administration Privileges
    const [adminRows] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (adminRows.length === 0 || adminRows[0].role !== 'admin' ) {
      return res.status(403).json({ error: 'Access denied. Management credentials required.' });
    }

    if (!req.file) return res.status(400).json({ error: 'Missing background graphic binary data payload.' });
    if (!name || name.trim() === "") return res.status(400).json({ error: 'Skin title name field is mandatory.' });

    const cost = parseInt(token_cost, 10) || 0;

    const query = `
      INSERT INTO platform_skins (id, name, token_cost, image_data, mime_type)
      VALUES (?, ?, ?, ?, ?)
    `;
    const skinId = crypto.randomUUID();
    await pool.query(query, [skinId, name.trim(), cost, req.file.buffer, req.file.mimetype]);

    return res.json({ success: true, message: 'Skin created successfully.', skinId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Administration upload channel crash.' });
  }
});
module.exports=router