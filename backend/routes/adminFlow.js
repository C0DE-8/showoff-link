const express = require('express');
const router = express.Router();
const { protect } = require('./auth');

/**
 * Middleware: Enforce Admin Role
 */
const requireAdmin = async (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
};

// Apply auth & admin guard to all routes in this file
router.use(protect, requireAdmin);


router.post('/tasks', async (req, res) => {
    const pool = req.app.get('pool')
    const client = await pool.connect();
    const { promptText, mediaType, category } = req.body;

    if (!promptText || !mediaType) {
        return res.status(400).json({ error: 'promptText and mediaType are required.' });
    }

    try {
        const result = await client.query(
            `INSERT INTO tob_tasks (prompt_text, media_type, category) 
             VALUES ($1, $2, $3) RETURNING *`,
            [promptText, mediaType, category || 'general']
        );
        return res.status(201).json({ message: 'Task created', task: result.rows[0] });
    } catch (err) {
        console.error('Admin Create Task Error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

router.get('/tasks', async (req, res) => {
    const pool = req.app.get('pool')
    const client = await pool.connect();
    const { category, limit = 50, offset = 0 } = req.query;

    try {
        let query = 'SELECT * FROM tob_tasks';
        let params = [];

        if (category) {
            query += ' WHERE category = $1';
            params.push(category);
        }

        query += ` ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await client.query(query, params);
        return res.status(200).json({ tasks: result.rows });
    } catch (err) {
        console.error('Admin Get Tasks Error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

router.delete('/tasks/:taskId', async (req, res) => {
    const pool = req.app.get('pool')
    const client = await pool.connect();
    const { taskId } = req.params;

    try {
        await client.query('DELETE FROM tob_tasks WHERE id = $1', [taskId]);
        return res.status(200).json({ message: 'Task deleted successfully' });
    } catch (err) {
        console.error('Admin Delete Task Error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

router.get('/rooms', async (req, res) => {
    const pool = req.app.get('pool')
    const client = await pool.connect();
    const { status = 'active' } = req.query;

    try {
        const rooms = await client.query(
            `SELECT r.*, u.username as creator_name,
                    (SELECT COUNT(*) FROM tob_room_participants WHERE room_id = r.id) as participant_count
             FROM tob_rooms r
             JOIN users u ON r.creator_id = u.id
             WHERE r.status = $1
             ORDER BY r.created_at DESC`,
            [status]
        );
        return res.status(200).json({ rooms: rooms.rows });
    } catch (err) {
        console.error('Admin Get Rooms Error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

router.post('/rooms/:roomId/terminate', async (req, res) => {
    const pool = req.app.get('pool')
    const client = await pool.connect();
    const { roomId } = req.params;

    try {
        await client.query('BEGIN');

        const roomRes = await client.query('SELECT * FROM tob_rooms WHERE id = $1 FOR UPDATE', [roomId]);
        if (roomRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Room not found.' });
        }
        const room = roomRes.rows[0];

        // Refund participants' pots in stake mode
        if (room.mode === 'stake_mode' && room.status !== 'completed') {
            const participants = await client.query(
                `SELECT user_id, current_pot FROM tob_room_participants WHERE room_id = $1`,
                [roomId]
            );
            for (const p of participants.rows) {
                if (p.current_pot > 0) {
                    await client.query('UPDATE users SET tokens = tokens + $1 WHERE id = $2', [p.current_pot, p.user_id]);
                }
            }
        }

        await client.query(`UPDATE tob_rooms SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [roomId]);

        await client.query('COMMIT');
        return res.status(200).json({ message: 'Room force terminated and tokens refunded if applicable.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Admin Terminate Room Error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

module.exports = router;
