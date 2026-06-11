const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign, requireUser } = require('../auth');
const { validEmail, passwordIssue } = require('../validate');
const { newToken, sendVerify, sendReset } = require('../mail');

const router = express.Router();

function page(title, body) {
  return `<!doctype html><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#FDF5DA;color:#1C222E;
    display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px">
    <div style="max-width:380px">
      <h1 style="font-size:24px;margin:0 0 10px">${title}</h1>
      <p style="color:#6b6b6b;line-height:1.5">${body}</p>
      <p style="margin-top:22px"><a href="/era" style="color:#E8393E;font-weight:600;text-decoration:none">&larr; Back to Era</a></p>
    </div></body>`;
}

// --- Register: enforce policy, create account, send verification ---
router.post('/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!validEmail(email)) return res.status(400).json({ error: 'invalid_email' });
  const issue = passwordIssue(password);
  if (issue) return res.status(400).json({ error: 'weak_password', rule: issue });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      'insert into users (email, password_hash) values ($1, $2) returning id, email',
      [email.toLowerCase(), hash]
    );
    const user = rows[0];
    const tok = newToken();
    await db.query(
      "insert into tokens (token, user_id, kind, expires_at) values ($1, $2, 'verify', now() + interval '7 days')",
      [tok, user.id]
    );
    sendVerify(user.email, tok).catch(e => console.error('verify mail failed', e.message));
    res.json({ token: sign(user), email: user.email, verified: false });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'email_taken' });
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- Login: returns verification status ---
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!validEmail(email) || !password) return res.status(400).json({ error: 'invalid_credentials' });
  try {
    const { rows } = await db.query(
      'select id, email, password_hash, email_verified from users where email = $1',
      [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'invalid_credentials' });
    res.json({ token: sign(user), email: user.email, verified: user.email_verified });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- Verify email (clicked from the email link) ---
router.get('/verify', async (req, res) => {
  const { token } = req.query;
  try {
    const { rows } = await db.query(
      "delete from tokens where token = $1 and kind = 'verify' and expires_at > now() returning user_id",
      [token]
    );
    if (!rows[0]) return res.status(400).send(page('Link expired', 'This verification link is invalid or has expired. Sign in and request a new one.'));
    await db.query('update users set email_verified = true where id = $1', [rows[0].user_id]);
    res.send(page('Email verified', 'Your account is secured. Daily reminders are on.'));
  } catch (e) {
    console.error(e);
    res.status(500).send(page('Something went wrong', 'Please try again in a moment.'));
  }
});

// --- Resend verification (logged in) ---
router.post('/resend-verification', requireUser, async (req, res) => {
  try {
    const { rows } = await db.query('select email, email_verified from users where id = $1', [req.user.uid]);
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    if (rows[0].email_verified) return res.json({ ok: true, already: true });
    await db.query("delete from tokens where user_id = $1 and kind = 'verify'", [req.user.uid]);
    const tok = newToken();
    await db.query(
      "insert into tokens (token, user_id, kind, expires_at) values ($1, $2, 'verify', now() + interval '7 days')",
      [tok, req.user.uid]
    );
    sendVerify(rows[0].email, tok).catch(e => console.error('verify mail failed', e.message));
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- Forgot password: always 200 so we never reveal which emails exist ---
router.post('/forgot', async (req, res) => {
  const { email } = req.body || {};
  try {
    if (validEmail(email)) {
      const { rows } = await db.query('select id from users where email = $1', [email.toLowerCase()]);
      if (rows[0]) {
        await db.query("delete from tokens where user_id = $1 and kind = 'reset'", [rows[0].id]);
        const tok = newToken();
        await db.query(
          "insert into tokens (token, user_id, kind, expires_at) values ($1, $2, 'reset', now() + interval '1 hour')",
          [tok, rows[0].id]
        );
        sendReset(email.toLowerCase(), tok).catch(e => console.error('reset mail failed', e.message));
      }
    }
  } catch (e) {
    console.error(e);
  }
  res.json({ ok: true });
});

// --- Reset password with a valid token ---
router.post('/reset', async (req, res) => {
  const { token, password } = req.body || {};
  const issue = passwordIssue(password);
  if (issue) return res.status(400).json({ error: 'weak_password', rule: issue });
  try {
    const { rows } = await db.query(
      "select user_id from tokens where token = $1 and kind = 'reset' and expires_at > now()",
      [token]
    );
    if (!rows[0]) return res.status(400).json({ error: 'invalid_token' });
    const hash = await bcrypt.hash(password, 10);
    await db.query('update users set password_hash = $1 where id = $2', [hash, rows[0].user_id]);
    await db.query("delete from tokens where token = $1", [token]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/me', requireUser, async (req, res) => {
  const { rows } = await db.query('select email, email_verified from users where id = $1', [req.user.uid]);
  res.json({ email: req.user.email, verified: rows[0] ? rows[0].email_verified : false });
});

module.exports = router;
