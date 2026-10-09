const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Native Node utility to build unique random secure tokens
const nodemailer = require('nodemailer');

const router = express.Router();
const JWT_SECRET = 'your_super_secure_jwt_secret_key_12345ghibs2567rjfhrfhhw';
const PUBLIC_API_URL = (process.env.PUBLIC_API_URL || 'https://api.showoff.c0de8.space').replace(/\/$/, '');
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://showoff-link.vercel.app').replace(/\/$/, '');
const MAIL_FROM = process.env.SMTP_FROM || '"Showoff Links" <no-reply@showoff.c0de8.space>';

// Use configured SMTP for live email; keep Ethereal as a development fallback.
async function getMailTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
    });
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SMTP_HOST and SMTP_FROM must be configured to send live account emails.');
  }

  const testAccount = await nodemailer.createTestAccount(); // Creates a fake free SMTP sandbox on Ethereal
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
}

// =========================================================================
// MIDDLEWARE: Protect Routes and Verify Roles
// =========================================================================
const protect = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const pool = req.app.get('pool');

      const userRes = await pool.query(
        'SELECT id, email, role, is_verified FROM users WHERE id = ?',
        [decoded.id]
      );

      const [userRows] = userRes;
      if (userRows.length === 0) {
        return res.status(401).json({ error: 'User no longer exists.' });
      }

      const user = userRows[0];

      if (!user.is_verified) {
        return res.status(403).json({ error: 'Please verify your email before accessing this resource.' });
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
      }

      req.user = user;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
  };
};


router.post('/register', async (req, res) => {
  const { full_name, email, password, tagname } = req.body;
  const pool = req.app.get('pool');

  try {
    if (!full_name || !email || !password || !tagname) {
      return res.status(400).json({ error: 'All fields are required, including a unique tagname.' });
    }

    // Validate tagname format (alphanumeric and underscores only, no spaces)
    const tagnameRegex = /^[a-zA-Z0-9_]+$/;
    if (!tagnameRegex.test(tagname)) {
      return res.status(400).json({ error: 'Tagname can only contain letters, numbers, and underscores.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const query = `
      INSERT INTO users (id, full_name, email, password_hash, verification_token, tagname, is_verified)
      VALUES (?, ?, ?, ?, ?, ?, FALSE)
    `;
    // Force lowercase on unique identifiers to prevent case-sensitivity collisions
    const normalizedEmail = email.toLowerCase().trim();
    const values = [crypto.randomUUID(), full_name, normalizedEmail, passwordHash, verificationToken, tagname.toLowerCase().trim()];
    await pool.query(query, values);
    const [userRows] = await pool.query(
      'SELECT id, tagname FROM users WHERE email = ?',
      [normalizedEmail]
    );

    const transporter = await getMailTransporter();
    const verificationUrl = `${PUBLIC_API_URL}/auth/verify-email?token=${encodeURIComponent(verificationToken)}`;

    const info = await transporter.sendMail({
      from: MAIL_FROM,
      to: email,
      subject: "Verify Your Account Registration",
      html: `<p>Thank you for registering. Please click the link below to verify your email:</p>
             <a href="${verificationUrl}">${verificationUrl}</a>`
    });

    res.status(201).json({ 
      message: 'Registration successful! Verification email generated.', 
      user: { id: userRows[0].id, tagname: userRows[0].tagname },
      preview: nodemailer.getTestMessageUrl(info)
    });

  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const duplicateKey = err.sqlMessage || err.message || '';
      if (duplicateKey.includes('email')) return res.status(400).json({ error: 'Email already registered.' });
      if (duplicateKey.includes('tagname')) return res.status(400).json({ error: 'Tagname is already taken.' });
    }
    res.status(500).json({ error: 'Registration failed.', details: err.message });
  }
});

// 2. VERIFY EMAIL (Consumes token, activates user)
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  const pool = req.app.get('pool');

  if (!token) return res.status(400).json({ error: 'Token is required.' });

  try {
    const result = await pool.query(
      'UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE verification_token = ?',
      [token]
    );

    const [updateResult] = result;
    if (updateResult.affectedRows === 0) {
      return res.status(400).send('<h1>Verification failed. Token invalid or already used.</h1>');
    }

    res.send('<h1>Email Verified successfully! You can now log in to your account.</h1>');
  } catch (err) {
    res.status(500).send('Server error processing verification.');
  }
});

// 3. LOGIN (Rejects unverified profiles)
router.post('/login', async (req, res) => {
  const { identifier, email, password } = req.body;
  const pool = req.app.get('pool');
  const loginIdentifier = String(identifier ?? email ?? '').trim();

  try {
    const [userRows] = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(full_name) = LOWER(?)',
      [loginIdentifier, loginIdentifier]
    );
    if (userRows.length === 0) return res.status(401).json({ error: 'Invalid credentials.' });

    const user = userRows[0];

    if (!user.is_verified) {
      return res.status(403).json({ error: 'Account email has not been verified yet.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. FORGOT PASSWORD (Generates short-lived reset link)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const pool = req.app.get('pool');

  try {
    const [userRows] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'No account associated with that email.' });
    }

    const resetToken = crypto.randomInt(100000, 1000000).toString();
    const expiresTime = new Date(Date.now() + 3600000); // 1 Hour lifespan window limit

    await pool.query(
      'UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE email = ?',
      [resetToken, expiresTime, email.toLowerCase().trim()]
    );

    const transporter = await getMailTransporter();
    const resetUrl = `${PUBLIC_SITE_URL}/reset.html?code=${encodeURIComponent(resetToken)}`;

    const info = await transporter.sendMail({
      from: MAIL_FROM,
      to: email,
      subject: "Password Reset Request",
            html: `<p>You requested a password reset.</p>
              <p>Your six-digit reset code is:</p>
              <h2>${resetToken}</h2>
              <p>Enter this code on the password reset page. It expires in one hour.</p>
              <a href="${resetUrl}">Open password reset page</a>`
    });

    console.log("--------------------- PASSWORD RECOVERY SIMULATOR ---------------------");
    console.log(`Recovery link generated for: ${email}`);
    console.log(`Click this URL to view email & link inside browser: ${nodemailer.getTestMessageUrl(info)}`);
    console.log("--------------------------------------------------------------------");

    res.json({ message: 'Reset link dispatched successfully.', preview: nodemailer.getTestMessageUrl(info) });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. RESET PASSWORD (Updates password, clears active tokens)
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  const pool = req.app.get('pool');

  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required.' });

  try {
    // Locate profile matching token where expiration threshold has not passed
    const userRes = await pool.query(
      'SELECT id FROM users WHERE reset_password_token = ? AND reset_password_expires > NOW()',
      [token]
    );

    const [userRows] = userRes;
    if (userRows.length === 0) {
      return res.status(400).json({ error: 'Reset token is invalid or has expired.' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await pool.query(
      `UPDATE users SET password_hash = ?, reset_password_token = NULL, reset_password_expires = NULL
       WHERE id = ?`,
      [newHash, userRows[0].id]
    );

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { authRouter: router, protect };
