const express = require('express');
const router = express.Router();
const { protect } = require('./auth'); // Assuming you have standard 

const getRandomTask = async (client) => {
    const res = await client.query('SELECT id, prompt_text, media_type FROM tob_tasks ORDER BY RANDOM() LIMIT 1');
    return res.rows[0];
};
 //create room
router.post('/rooms', protect, async (req, res) => {
    const pool = req.app.get('pool');
    const client = await pool.connect();
    const userId = req.user.id;
    const { mode, totalRounds, taggedFriends } = req.body;

    if (!['zero_stake', 'stake_mode'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode.' });
    }

    const rounds = Number(totalRounds);
    if (![3, 5].includes(rounds)) {
        return res.status(400).json({ error: 'Rounds must be either 3 or 5.' });
    }

    try {
        await client.query('BEGIN');

        const zeroStakeFee = 2; // Hardcoded per requirements
        const requiredStake = mode === 'stake_mode' ? Math.ceil(rounds / 3) : 0;

        // Fetch user token balance directly without founder check
        const userRes = await client.query('SELECT tokens FROM users WHERE id = $1 FOR UPDATE', [userId]);
        const currentTokens = userRes.rows[0]?.tokens || 0;

        const feeToDeduct = mode === 'zero_stake' ? zeroStakeFee : requiredStake;
        if (currentTokens < feeToDeduct) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Insufficient tokens. Required: ${feeToDeduct} tokens.` });
        }
        await client.query('UPDATE users SET tokens = tokens - $1 WHERE id = $2', [feeToDeduct, userId]);

        const roomRes = await client.query(
            `INSERT INTO tob_rooms (creator_id, mode, total_rounds, stake_per_round, total_staked_per_user, status) 
             VALUES ($1, $2, $3, $4, $5, 'waiting') RETURNING *`,
            [userId, mode, rounds, mode === 'stake_mode' ? 1 : 0, requiredStake]
        );
        const room = roomRes.rows[0];

        // Add creator
        await client.query(
            `INSERT INTO tob_room_participants (room_id, user_id, initial_staked, current_pot, status, consecutive_fails)
             VALUES ($1, $2, $3, $3, 'accepted', 0)`,
            [room.id, userId, requiredStake]
        );

        // Stage invites using tagname
        if (Array.isArray(taggedFriends) && taggedFriends.length > 0) {
            const friendsRes = await client.query(`SELECT id FROM users WHERE tagname = ANY($1)`, [taggedFriends]);
            for (const friend of friendsRes.rows) {
                if (friend.id === userId) continue;
                await client.query(
                    `INSERT INTO tob_room_participants (room_id, user_id, initial_staked, current_pot, status)
                     VALUES ($1, $2, $3, $3, 'pending')`,
                    [room.id, friend.id, requiredStake]
                );
            }
        }

        await client.query('COMMIT');
        return res.status(201).json({ message: 'Room created successfully', room });
    } catch (err) {
        await client.query('ROLLBACK');
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});
/**
 * 2. GET INVITATIONS (For HTTP Polling / Dashboard)
 */
router.get('/invitations', protect, async (req, res) => {
    const pool = req.app.get('pool');
    const client = await pool.connect();
    const userId = req.user.id;
    try {
        const invites = await client.query(
            `SELECT p.room_id, r.mode, r.total_rounds, r.total_staked_per_user, u.username as host_name 
             FROM tob_room_participants p
             JOIN tob_rooms r ON p.room_id = r.id
             JOIN users u ON r.creator_id = u.id
             WHERE p.user_id = $1 AND p.status = 'pending' AND r.status = 'waiting'`,
            [userId]
        );
        return res.status(200).json(invites.rows);
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

/**
 ACCEPT/DECLINE INVITATION
 */
router.post('/rooms/:roomId/join', protect, async (req, res) => {
    const pool = req.app.get('pool');
    const client = await pool.connect();
    const userId = req.user.id;
    const { roomId } = req.params;
    const { action } = req.body; // 'accept' or 'decline'

    try {
        await client.query('BEGIN');

        const roomRes = await client.query('SELECT * FROM tob_rooms WHERE id = $1 FOR UPDATE', [roomId]);
        if (roomRes.rows.length === 0 || roomRes.rows[0].status !== 'waiting') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Room unavailable.' });
        }
        const room = roomRes.rows[0];

        if (action === 'decline') {
            await client.query(`UPDATE tob_room_participants SET status = 'declined' WHERE room_id = $1 AND user_id = $2`, [roomId, userId]);
            await client.query('COMMIT');
            return res.status(200).json({ message: 'Declined' });
        }

        if (room.mode === 'stake_mode') {
            const userRes = await client.query('SELECT tokens, role FROM users WHERE id = $1 FOR UPDATE', [userId]);
            const isFounder = userRes.rows[0]?.role === 'founder';
            
            if (!isFounder) {
                if (userRes.rows[0].tokens < room.total_staked_per_user) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Insufficient tokens' });
                }
                await client.query('UPDATE users SET tokens = tokens - $1 WHERE id = $2', [room.total_staked_per_user, userId]);
            }
        }

        await client.query(
            `UPDATE tob_room_participants SET status = 'accepted', initial_staked = $1, current_pot = $1, consecutive_fails = 0 
             WHERE room_id = $2 AND user_id = $3`,
            [room.total_staked_per_user, roomId, userId]
        );

        await client.query('COMMIT');
        return res.status(200).json({ message: 'Joined successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        return res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

router.post('/rooms/:roomId/start', protect, async (req, res) => {
    const pool = req.app.get('pool');
    const client = await pool.connect();
    const userId = req.user.id;
    const { roomId } = req.params;

    try {
        await client.query('BEGIN');
        const roomRes = await client.query('SELECT * FROM tob_rooms WHERE id = $1 FOR UPDATE', [roomId]);
        
        if (roomRes.rows[0].creator_id !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Only host can start' });
        }

        const participants = await client.query(`SELECT user_id FROM tob_room_participants WHERE room_id = $1 AND status = 'accepted'`, [roomId]);
        if (participants.rows.length < 2) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Need at least 2 players' });
        }

        const targetId = participants.rows[Math.floor(Math.random() * participants.rows.length)].user_id;
        const task = await getRandomTask(client);

        // Turn expiration set 50 seconds from now
        const turnExpiry = new Date(Date.now() + 50 * 1000); 

        await client.query(
            `UPDATE tob_rooms 
             SET status = 'active', current_round = 1, current_target_id = $1, current_task_id = $2, turn_expires_at = $3
             WHERE id = $4`,
            [targetId, task.id, turnExpiry, roomId]
        );

        await client.query('COMMIT');
        return res.status(200).json({ message: 'Game started' });
    } catch (err) {
        await client.query('ROLLBACK');
        return res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});
 
router.get('/rooms/:roomId/state', protect, async (req, res) => {
    const pool = req.app.get('pool');
    const client = await pool.connect();
    const { roomId } = req.params;

    try {
        const roomRes = await client.query(
            `SELECT r.*, t.prompt_text, t.media_type 
             FROM tob_rooms r 
             LEFT JOIN tob_tasks t ON r.current_task_id = t.id 
             WHERE r.id = $1`, [roomId]);
             
        if (roomRes.rows.length === 0) return res.status(404).json({ error: 'Room not found' });
        const room = roomRes.rows[0];

        // Check if current turn expired server-side
        if (room.status === 'active' && room.turn_expires_at && new Date() > new Date(room.turn_expires_at)) {
            // Auto-burn logic handled securely server-side.
            // (You would typically offload this to a worker, or handle the state shift right here 
            // if the polling client detects it's expired. To keep it simple, we let the client trigger a "timeout" route, 
            // or we shift the turn immediately here).
            room.turn_expired = true; 
        }

        const players = await client.query(`SELECT user_id, current_pot, consecutive_fails FROM tob_room_participants WHERE room_id = $1 AND status = 'accepted'`, [roomId]);

        return res.status(200).json({ room, players: players.rows });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

router.post('/rooms/:roomId/turn', protect, async (req, res) => {
    const pool = req.app.get('pool');
    const client = await pool.connect();
    const userId = req.user.id;
    const { roomId } = req.params;
    const { choice, mediaUrl } = req.body; 

    try {
        await client.query('BEGIN');
        const roomRes = await client.query('SELECT * FROM tob_rooms WHERE id = $1 FOR UPDATE', [roomId]);
        const room = roomRes.rows[0];

        if (room.current_target_id !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Not your turn' });
        }
        if (new Date() > new Date(room.turn_expires_at)) {
            // If they are late, force a burn
            req.body.choice = 'burn'; 
        }

        const playerRes = await client.query('SELECT * FROM tob_room_participants WHERE room_id = $1 AND user_id = $2 FOR UPDATE', [roomId, userId]);
        let player = playerRes.rows[0];

        let gameEnded = false;

        if (choice === 'burn' || req.body.choice === 'burn') {
            // Deduct pot in stake mode
            if (room.mode === 'stake_mode') {
                const penalty = 1; // 1 token penalty per burn
                await client.query(`UPDATE tob_room_participants SET current_pot = GREATEST(current_pot - $1, 0) WHERE room_id = $2 AND user_id = $3`, [penalty, roomId, userId]);
            }
            
            // Zero-stake death rule
            if (room.mode === 'zero_stake') {
                const fails = player.consecutive_fails + 1;
                await client.query(`UPDATE tob_room_participants SET consecutive_fails = $1 WHERE room_id = $2 AND user_id = $3`, [fails, roomId, userId]);
                
                if (fails >= 2) {
                    gameEnded = true;
                }
            }
        } else if (choice === 'truth') {
            // Reset fails if they successfully submit truth
            await client.query(`UPDATE tob_room_participants SET consecutive_fails = 0 WHERE room_id = $1 AND user_id = $2`, [roomId, userId]);
            
            // Store their media payload to the room history so others polling can view it
            await client.query(`INSERT INTO tob_history (room_id, user_id, task_id, media_url) VALUES ($1, $2, $3, $4)`, [roomId, userId, room.current_task_id, mediaUrl]);
        }

        // Handle Game End or Next Turn
        if (gameEnded || room.current_round >= room.total_rounds * 2) { // Example: assuming rounds means full table cycles
            await client.query(`UPDATE tob_rooms SET status = 'completed', current_target_id = NULL WHERE id = $1`, [roomId]);
            
            // Refund remaining pots
            if (room.mode === 'stake_mode') {
                const participants = await client.query(`SELECT user_id, current_pot FROM tob_room_participants WHERE room_id = $1`, [roomId]);
                for (const p of participants.rows) {
                    if (p.current_pot > 0) {
                        await client.query(`UPDATE users SET tokens = tokens + $1 WHERE id = $2`, [p.current_pot, p.user_id]);
                    }
                }
            }
        } else {
            // Shift to next player
            const allPlayers = await client.query(`SELECT user_id FROM tob_room_participants WHERE room_id = $1 AND status = 'accepted' ORDER BY id`, [roomId]);
            const currentIndex = allPlayers.rows.findIndex(p => p.user_id === userId);
            const nextPlayer = allPlayers.rows[(currentIndex + 1) % allPlayers.rows.length].user_id;
            
            const nextTask = await getRandomTask(client);
            const turnExpiry = new Date(Date.now() + 50 * 1000); 

            // Increment round if it wrapped back to the host
            let nextRound = room.current_round;
            if (nextPlayer === room.creator_id) nextRound += 1;

            await client.query(
                `UPDATE tob_rooms SET current_target_id = $1, current_task_id = $2, turn_expires_at = $3, current_round = $4 WHERE id = $5`,
                [nextPlayer, nextTask.id, turnExpiry, nextRound, roomId]
            );
        }

        await client.query('COMMIT');
        return res.status(200).json({ message: gameEnded ? 'Game over due to 2 fails' : 'Turn processed', gameEnded });

    } catch (err) {
        await client.query('ROLLBACK');
        return res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

module.exports = router;
