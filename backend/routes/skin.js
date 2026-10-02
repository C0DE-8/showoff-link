const express = require('express');
const { protect } = require('./auth');
const router =express.Router()

//get users skins
router.get('/skins/inventory', protect(), async (req, res) => {
  const pool = req.app.get('pool');
  const userId = req.user.id;

  try {
    const query = `
      SELECT 
        s.id, 
        s.name, 
        s.image_data,
        s.mime_type,
        us.is_equipped
      FROM user_skins us
      INNER JOIN platform_skins s ON s.id = us.skin_id
      WHERE us.user_id = ?
      ORDER BY us.is_equipped DESC
    `;

    const [rows] = await pool.query(query, [userId]);

    const formattedInventory = rows.map(row => {
      let imageUri = null;

      if (row.image_data) {
        // Handle mysql2 binary Buffer or string format
        const buffer = Buffer.isBuffer(row.image_data) 
          ? row.image_data 
          : Buffer.from(row.image_data);

        const base64String = buffer.toString('base64');
        const mimeType = row.mime_type || 'image/jpeg';

        imageUri = `data:${mimeType};base64,${base64String}`;
      }

      return {
        id: row.id,
        name: row.name,
        is_equipped: row.is_equipped,
        image_data: imageUri
      };
    });

    return res.json({
      success: true,
      count: formattedInventory.length,
      inventory: formattedInventory
    });
  } catch (err) {
    console.error('Error fetching user skin inventory:', err);
    return res.status(500).json({ error: 'Failed to retrieve skin inventory.' });
  }
});



// GET ALL PLATFORM SKINS WITH EMBEDDED BASE64 IMAGES
router.get('/skins/all-images', protect(), async (req, res) => {
  const pool = req.app.get('pool');

  try {
    const query = `
      SELECT id, name, token_cost, image_data, mime_type 
      FROM platform_skins 
      ORDER BY token_cost ASC
    `;

    const [rows] = await pool.query(query);

    // Format binary data into Base64 data URLs
    const skins = rows.map(skin => {
      let imageBase64 = null;

      if (skin.image_data) {
        const mime = skin.mime_type || 'image/jpeg';
        imageBase64 = `data:${mime};base64,${skin.image_data.toString('base64')}`;
      }

      return {
        id: skin.id,
        name: skin.name,
        token_cost: skin.token_cost,
        image_url: imageBase64
      };
    });

    return res.json({ success: true, skins });
  } catch (err) {
    console.error('Error fetching all skin graphics:', err);
    return res.status(500).json({ error: 'Failed to retrieve skin images.' });
  }
});


// PURCHASE TRANSACTION HANDLING
router.post('/skins/buy/:id', protect(), async (req, res) => {
  const pool = req.app.get('pool');
  const skinId = req.params.id;
  const userId = req.user.id;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [skinRows] = await connection.query('SELECT token_cost FROM platform_skins WHERE id = ?', [skinId]);
    if (skinRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Target skin does not exist.' });
    }
    const cost = skinRows[0].token_cost;

    const [ownedRows] = await connection.query('SELECT 1 FROM user_skins WHERE user_id = ? AND skin_id = ?', [userId, skinId]);
    if (ownedRows.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Theme already loaded within asset ecosystem inventory blocks.' });
    }

    const [walletRows] = await connection.query('SELECT tokens FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (walletRows[0].tokens < cost) {
      await connection.rollback();
      connection.release();
      return res.status(402).json({ error: `Transaction rejected. Requires ${cost} tokens.` });
    }

    await connection.query('UPDATE users SET tokens = tokens - ? WHERE id = ?', [cost, userId]);
    await connection.query('INSERT INTO user_skins (user_id, skin_id) VALUES (?, ?)', [userId, skinId]);

    await connection.commit();
    connection.release();
    return res.json({ success: true, message: 'Purchase processed cleanly.' });
  } catch (err) {
    if (connection) {
      await connection.rollback().catch(() => {});
      connection.release();
    }
    console.error(err);
    return res.status(500).json({ error: 'Store core database failure.' });
  }
});

//equip skin
router.post('/skins/equip/:id', protect(), async (req, res) => {
  const pool = req.app.get('pool');
  const skinId = req.params.id;
  const userId = req.user.id;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Verify the user actually owns the skin they want to equip
    const [ownershipRows] = await connection.query(
      'SELECT 1 FROM user_skins WHERE user_id = ? AND skin_id = ?',
      [userId, skinId]
    );

    if (ownershipRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({ error: "You must purchase this skin before equipping it." });
    }

    // 2. Un-equip any currently active skins for this user
    await connection.query(
      'UPDATE user_skins SET is_equipped = false WHERE user_id = ?',
      [userId]
    );

    // 3. Equip the newly selected skin
    await connection.query(
      'UPDATE user_skins SET is_equipped = true WHERE user_id = ? AND skin_id = ?',
      [userId, skinId]
    );

    await connection.commit();
    connection.release();
    return res.json({ success: true, message: 'Skin equipped successfully as your default theme!' });

  } catch (err) {
    if (connection) {
      await connection.rollback().catch(() => {});
      connection.release();
    }
    console.error(err);
    return res.status(500).json({ error: 'Failed to update skin configuration.' });
  }
});
module.exports=router