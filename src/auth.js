const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const TTL = '180d';

function sign(user) {
  return jwt.sign({ uid: user.id, email: user.email }, SECRET, { expiresIn: TTL });
}

// Soft auth: attaches req.user if a valid token is present, otherwise continues anonymously.
function withUser(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (token) {
    try { req.user = jwt.verify(token, SECRET); } catch (_) { /* ignore bad token */ }
  }
  next();
}

// Hard auth: 401 if not logged in.
function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'auth_required' });
  next();
}

module.exports = { sign, withUser, requireUser };
