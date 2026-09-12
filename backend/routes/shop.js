const express = require('express');
const router = express.Router();
const { protect } = require('./auth');

router.get('/payment-details', async (req, res) => {
  const pool = req.app.get('pool');

  try {
    const result = await pool.query(
      'SELECT bank_name, account_number, account_name FROM bank_account_settings WHERE id = 1'
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bank account details are not configured.' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching bank details:', err);
    return res.status(500).json({ error: 'Failed to retrieve payment details.' });
  }
});

// ==========================================
// 2. USER SUBMIT TOP-UP REQUEST (Protected User Route)
// ==========================================
router.post('/submit-request', protect(), async (req, res) => {
  const pool = req.app.get('pool');
  
  // Extract userId directly from authenticated user session/token
  const userId = req.user.id; 
  const { tokensRequested, amountNgn, receiptUrl } = req.body;

  if (!tokensRequested || !amountNgn || !receiptUrl) {
    return res.status(400).json({ error: 'Missing required request parameters.' });
  }

  try {
    const query = `
      INSERT INTO token_purchases (user_id, tokens_requested, amount_ngn, receipt_url, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
      RETURNING id, status, created_at
    `;

    const result = await pool.query(query, [userId, tokensRequested, amountNgn, receiptUrl]);

    return res.status(201).json({
      success: true,
      message: 'Top-up request submitted successfully. Awaiting approval.',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error submitting top-up request:', err);
    return res.status(500).json({ error: 'Failed to submit top-up request.' });
  }
});

// ==========================================
// 3. ADMIN VERIFY / APPROVE TOP-UP (Admin Only)
// ==========================================
router.post('/verify-topup', protect(['admin']), async (req, res) => {
  const pool = req.app.get('pool');
  const { requestId, action } = req.body; // action: 'approve' | 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action parameter.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock request row to prevent race conditions or double claims
    const requestRes = await client.query(
      'SELECT user_id, tokens_requested, status FROM token_purchases WHERE id = $1 FOR UPDATE',
      [requestId]
    );

    if (requestRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase request not found.' });
    }

    const request = requestRes.rows[0];

    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Request has already been ${request.status}.` });
    }

    if (action === 'approve') {
      // Allocate tokens directly to user wallet metrics
      await client.query(
        'UPDATE users SET tokens = tokens + $1 WHERE id = $2',
        [request.tokens_requested, request.user_id]
      );

      // Set status to approved
      await client.query(
        "UPDATE token_purchases SET status = 'approved', updated_at = NOW() WHERE id = $1",
        [requestId]
      );
    } else {
      // Set status to rejected
      await client.query(
        "UPDATE token_purchases SET status = 'rejected', updated_at = NOW() WHERE id = $1",
        [requestId]
      );
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `Request successfully updated status to ${action}d.`
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transactional resolution processing error:', err);
    return res.status(500).json({ error: 'Transactional resolution processing error.' });
  } finally {
    client.release();
  }
});

// ==========================================
// 4. ADMIN UPDATE BANK ACCOUNT INFO (Admin Only)
// ==========================================
router.put('/admin/update-account', protect(['admin']), async (req, res) => {
  const pool = req.app.get('pool');
  const { bankName, accountNumber, accountName } = req.body;

  if (!bankName || !accountNumber || !accountName) {
    return res.status(400).json({ error: 'All account fields (bankName, accountNumber, accountName) are required.' });
  }

  try {
    const query = `
      INSERT INTO bank_account_settings (id, bank_name, account_number, account_name, updated_at)
      VALUES (1, $1, $2, $3, NOW())
      ON CONFLICT (id) DO UPDATE SET
        bank_name = EXCLUDED.bank_name,
        account_number = EXCLUDED.account_number,
        account_name = EXCLUDED.account_name,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [bankName, accountNumber, accountName]);

    return res.json({
      success: true,
      message: 'Payment bank details successfully updated.',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating bank settings:', err);
    return res.status(500).json({ error: 'Failed to update payment settings.' });
  }
});

// ==========================================
// 5. ADMIN GET ALL PENDING PURCHASES (Admin Only)
// ==========================================
router.get('/admin/pending-purchases', protect(['admin']), async (req, res) => {
  const pool = req.app.get('pool');

  try {
    const query = `
      SELECT 
        tp.id, 
        tp.user_id, 
        u.email, 
        tp.tokens_requested, 
        tp.amount_ngn, 
        tp.receipt_url, 
        tp.created_at 
      FROM token_purchases tp
      JOIN users u ON tp.user_id = u.id
      WHERE tp.status = 'pending'
      ORDER BY tp.created_at DESC
    `;

    const result = await pool.query(query);

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching pending purchases:', err);
    return res.status(500).json({ error: 'Failed to fetch pending purchase requests.' });
  }
});

module.exports = router;
