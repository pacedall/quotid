// Input validation shared across auth routes.

function validEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// Policy: at least 8 characters, with a letter, a number, and a symbol.
// Returns null if OK, or a short rule code describing the first failure.
function passwordIssue(p) {
  if (typeof p !== 'string' || p.length < 8) return 'min8';
  if (!/[A-Za-z]/.test(p)) return 'letter';
  if (!/[0-9]/.test(p)) return 'number';
  if (!/[^A-Za-z0-9]/.test(p)) return 'special';
  return null;
}

const PASSWORD_RULE_TEXT = 'At least 8 characters, including a letter, a number and a symbol.';

module.exports = { validEmail, passwordIssue, PASSWORD_RULE_TEXT };
