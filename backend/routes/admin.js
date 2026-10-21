const express = require('express');
const { protect } = require('./auth');
const multer = require('multer');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Replace your entire diskStorage setup with this:
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// GET /api/admin/users — list all user accounts.
router.get('/users', protect(['admin']), async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const [users] = await pool.query(
      'SELECT id, full_name, email, tagname, role, tokens, is_verified, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users });
  } catch (err) {
    console.error('Admin user listing failed:', err);
    res.status(500).json({ error: 'Unable to load users.' });
  }
});

// PATCH /api/admin/users/:userId/tokens — set a user's token balance.
router.patch('/users/:userId/tokens', protect(['admin']), async (req, res) => {
  const tokens = Number(req.body.tokens);
  if (!Number.isSafeInteger(tokens) || tokens < 0) {
    return res.status(400).json({ error: 'Token balance must be a non-negative whole number.' });
  }

  try {
    const pool = req.app.get('pool');
    const [result] = await pool.query('UPDATE users SET tokens = ? WHERE id = ?', [tokens, req.params.userId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'User not found.' });
    return res.json({ success: true, message: 'Token balance updated.', tokens });
  } catch (err) {
    console.error('Admin token balance update failed:', err);
    return res.status(500).json({ error: 'Unable to update token balance.' });
  }
});

// PATCH /api/admin/users/:userId/password — reset a user's password.
router.patch('/users/:userId/password', protect(['admin']), async (req, res) => {
  const { newPassword } = req.body;
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const pool = req.app.get('pool');
    const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [req.params.userId]);
    if (!users.length) return res.status(404).json({ error: 'User not found.' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?',
      [passwordHash, req.params.userId]
    );
    res.json({ message: 'User password reset successfully.' });
  } catch (err) {
    console.error('Admin password reset failed:', err);
    res.status(500).json({ error: 'Unable to reset this password.' });
  }
});

// PATCH /api/admin/users/:userId/verification — update account verification status.
router.patch('/users/:userId/verification', protect(['admin']), async (req, res) => {
  const { isVerified } = req.body;
  if (typeof isVerified !== 'boolean') {
    return res.status(400).json({ error: 'Verification status must be true or false.' });
  }
  if (req.params.userId === req.user.id && !isVerified) {
    return res.status(400).json({ error: 'You cannot unverify your own admin account.' });
  }

  try {
    const pool = req.app.get('pool');
    const [result] = await pool.query('UPDATE users SET is_verified = ? WHERE id = ?', [isVerified, req.params.userId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: isVerified ? 'User verified successfully.' : 'User verification removed.', isVerified });
  } catch (err) {
    console.error('Admin user verification update failed:', err);
    res.status(500).json({ error: 'Unable to update user verification.' });
  }
});

// DELETE /api/admin/users/:userId — delete a user and their uploaded content.
router.delete('/users/:userId', protect(['admin']), async (req, res) => {
  const targetUserId = req.params.userId;
  if (targetUserId === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own admin account.' });
  }

  let connection;
  try {
    const pool = req.app.get('pool');
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [users] = await connection.query('SELECT id, role FROM users WHERE id = ? FOR UPDATE', [targetUserId]);
    if (!users.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'User not found.' });
    }
    if (users[0].role === 'admin') {
      await connection.rollback();
      return res.status(403).json({ error: 'Admin accounts cannot be deleted from user management.' });
    }

    const [images] = await connection.query('SELECT image_path FROM images WHERE user_id = ?', [targetUserId]);
    await connection.query('UPDATE images SET recipient_id = NULL WHERE recipient_id = ?', [targetUserId]);
    await connection.query('UPDATE text_notes SET recipient_id = NULL WHERE recipient_id = ?', [targetUserId]);
    await connection.query('DELETE FROM images WHERE user_id = ?', [targetUserId]);
    await connection.query('DELETE FROM text_notes WHERE user_id = ?', [targetUserId]);
    await connection.query('DELETE FROM users WHERE id = ?', [targetUserId]);
    await connection.commit();

    const uploadsDir = path.resolve(__dirname, '..', 'uploads');
    for (const image of images) {
      const imagePath = path.resolve(image.image_path);
      if (imagePath.startsWith(`${uploadsDir}${path.sep}`)) {
        await fs.promises.unlink(imagePath).catch(() => {});
      }
    }

    res.json({ message: 'User and their uploaded content were deleted.' });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    console.error('Admin user deletion failed:', err);
    res.status(500).json({ error: 'Unable to delete user.' });
  } finally {
    if (connection) connection.release();
  }
});

// POST /api/admin/admin/upload-skin — upload a platform skin.
router.post('/admin/upload-skin', protect(['admin']), upload.single('skinGraphic'), async (req, res) => {
  const pool = req.app.get('pool');
  const { name, token_cost } = req.body;

  try {
    if (!req.file) return res.status(400).json({ error: 'Missing background graphic binary data payload.' });
    if (!name || name.trim() === "") return res.status(400).json({ error: 'Skin title name field is mandatory.' });

    const cost = Number.parseInt(token_cost, 10);
    if (!Number.isInteger(cost) || cost < 0) {
      return res.status(400).json({ error: 'Token cost must be zero or greater.' });
    }

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
