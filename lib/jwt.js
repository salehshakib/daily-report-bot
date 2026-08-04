/**
 * Decode JWT payload without verifying signature (we only need claims like exp).
 */
function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function getTokenExp(token) {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  return typeof exp === 'number' ? exp : null;
}

/** True when exp is in the future (optional skew in seconds). */
function isTokenValid(token, skewSeconds = 30) {
  const exp = getTokenExp(token);
  if (!exp) return false;
  return exp * 1000 > Date.now() + skewSeconds * 1000;
}

module.exports = {
  getTokenExp,
  isTokenValid,
};
