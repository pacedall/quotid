// Email delivery. Uses Resend when RESEND_API_KEY is set; otherwise logs the
// link to the console so the flows are fully testable in local dev.
const crypto = require('crypto');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const FROM = process.env.MAIL_FROM || process.env.REMINDER_FROM || 'Quotid <hello@quotidgames.com>';

let resend = null;
if (process.env.RESEND_API_KEY) {
  const { Resend } = require('resend');
  resend = new Resend(process.env.RESEND_API_KEY);
}

function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

async function deliver(to, subject, html, devLink) {
  if (!resend) {
    console.log(`\n[mail:dev] → ${to}\n   ${subject}\n   ${devLink}\n`);
    return { dev: true };
  }
  return resend.emails.send({ from: FROM, to, subject, html });
}

function sendVerify(to, token) {
  const url = `${APP_URL}/api/auth/verify?token=${token}`;
  return deliver(
    to,
    'Verify your Quotid email',
    `<p>Confirm your email to secure your account and turn on daily reminders.</p>
     <p><a href="${url}">Verify my email →</a></p>`,
    url
  );
}

function sendReset(to, token) {
  const url = `${APP_URL}/reset?token=${token}`;
  return deliver(
    to,
    'Reset your Quotid password',
    `<p>Tap below to choose a new password. This link expires in 1 hour.</p>
     <p><a href="${url}">Reset my password →</a></p>
     <p style="color:#888;font-size:12px">If you didn't request this, you can ignore this email.</p>`,
    url
  );
}

module.exports = { newToken, sendVerify, sendReset };
