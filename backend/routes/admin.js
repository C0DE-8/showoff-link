const express = require('express');
const { protect } = require('./auth');
const multer = require('multer');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Replace your entire diskStorage setup with this:
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/admin/analytics', protect(), async (req, res) => {
  const pool = req.app.get('pool');
  const userId = req.user.id;

  try {
    // 1. Authorization Gate Check: Verify user has true admin status privilege flag
    const adminCheck = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== "admin") {
      return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }

    // 2. Parallel Query Executions for platform metadata metrics
    const userStatsQuery = `
      SELECT 
        COUNT(*) as total_users,
        SUM(tokens) as total_circulating_tokens,
        AVG(tokens)::NUMERIC(10,2) as avg_token_balance
      FROM users
    `;

    const noteStatsQuery = `
      SELECT 
        COUNT(*) as active_notes,
        SUM(current_views) as total_note_views_recorded,
        COUNT(CASE WHEN recipient_id IS NULL THEN 1 END) as open_public_notes,
        COUNT(CASE WHEN recipient_id IS NOT NULL THEN 1 END) as targeted_private_notes
      FROM text_notes
    `;

    const imageStatsQuery = `
      SELECT 
        COUNT(*) as active_images_in_db,
        SUM(LENGTH(image_path)) as total_image_storage_bytes,
        COUNT(CASE WHEN recipient_id IS NULL THEN 1 END) as open_public_images
      FROM images
    `;

    const voiceStatsQuery = `
      SELECT 
        COUNT(*) as active_voices_in_db,
        SUM(current_plays) as total_playback_events,
        COUNT(CASE WHEN recipient_id IS NULL THEN 1 END) as open_public_voices
      FROM voice_notes
    `;

    // Fetch the 5 most recent platform activities for live administration feed overview
    const recentActivityQuery = `
      (SELECT 'text_note' as asset_type, id, created_at, user_id, (recipient_id IS NULL) as is_public FROM text_notes)
      UNION ALL
      (SELECT 'image' as asset_type, id, created_at, user_id, (recipient_id IS NULL) as is_public FROM images)
      UNION ALL
      (SELECT 'voice_note' as asset_type, id, created_at, user_id, (recipient_id IS NULL) as is_public FROM voice_notes)
      ORDER BY created_at DESC
      LIMIT 5
    `;

    // Resolve all analytics blocks asynchronously 
    const [
      userStatsRes, 
      noteStatsRes, 
      imageStatsRes, 
      voiceStatsRes,
      recentActivityRes
    ] = await Promise.all([
      pool.query(userStatsQuery),
      pool.query(noteStatsQuery),
      pool.query(imageStatsQuery),
      pool.query(voiceStatsQuery),
      pool.query(recentActivityQuery)
    ]);

    const users = userStatsRes.rows[0];
    const notes = noteStatsRes.rows[0];
    const images = imageStatsRes.rows[0];
    const voices = voiceStatsRes.rows[0];

    // 3. Compile Consolidated Dashboard Payload Output
    return res.json({
      success: true,
      timestamp: new Date(),
      ecosystem: {
        total_registered_users: parseInt(users.total_users, 10),
        total_circulating_tokens: parseInt(users.total_circulating_tokens, 10) || 0,
        average_user_wallet_balance: parseFloat(users.avg_token_balance) || 0.00
      },
      assets_active_inventory: {
        text_notes: {
          current_active_count: parseInt(notes.active_notes, 10),
          accumulated_views: parseInt(notes.total_note_views_recorded, 10) || 0,
          distribution_public_links: parseInt(notes.open_public_notes, 10),
          distribution_private_locked: parseInt(notes.targeted_private_notes, 10)
        },
        image_storage: {
          current_active_count: parseInt(images.active_images_in_db, 10),
          allocated_disk_space_mb: parseFloat((parseInt(images.total_image_storage_bytes, 10) || 0) / (1024 * 1024)).toFixed(2),
          distribution_public_links: parseInt(images.open_public_images, 10)
        },
        voice_notes: {
          current_active_count: parseInt(voices.active_voices_in_db, 10),
          total_streams_served: parseInt(voices.total_playback_events, 10) || 0,
          distribution_public_links: parseInt(voices.open_public_voices, 10)
        }
      },
      recent_platform_events: recentActivityRes.rows.map(event => ({
        asset_type: event.asset_type,
        asset_uuid: event.id,
        creator_id: event.user_id,
        privacy_mode: event.is_public ? 'Public Burner Link' : 'Targeted Recipient Lock',
        created_at: event.created_at
      }))
    });

  } catch (err) {
    console.error("!!! CRITICAL ADMIN PIPELINE EXCEPTION !!!");
    console.error(err);
    return res.status(500).json({ error: 'Failed to securely aggregate administrative analytics data.', details: err.message });
  }
});

router.post('/admin/upload-skin', protect(), upload.single('skinGraphic'), async (req, res) => {
  const pool = req.app.get('pool');
  const userId = req.user.id;
  const { name, token_cost } = req.body;

  try {
    // 1. Verify Administration Privileges
    const adminCheck = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin' ) {
      return res.status(403).json({ error: 'Access denied. Management credentials required.' });
    }

    if (!req.file) return res.status(400).json({ error: 'Missing background graphic binary data payload.' });
    if (!name || name.trim() === "") return res.status(400).json({ error: 'Skin title name field is mandatory.' });

    const cost = parseInt(token_cost, 10) || 0;

    const query = `
      INSERT INTO platform_skins (name, token_cost, image_data, mime_type)
      VALUES ($1, $2, $3, $4) RETURNING id
    `;
    const result = await pool.query(query, [name.trim(), cost, req.file.buffer, req.file.mimetype]);

    return res.json({ success: true, message: 'Skin created successfully.', skinId: result.rows[0].id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Administration upload channel crash.' });
  }
});
module.exports=router