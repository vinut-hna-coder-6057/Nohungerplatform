const revokedTokens = new Map();

function revokeToken(jti, expiresAt) {
  if (!jti) return;
  const expiry = Number.isFinite(expiresAt) ? expiresAt * 1000 : Date.now();
  revokedTokens.set(jti, expiry);
}

function isTokenRevoked(jti) {
  if (!jti) return false;
  const expiry = revokedTokens.get(jti);
  if (!expiry) return false;
  if (expiry <= Date.now()) {
    revokedTokens.delete(jti);
    return false;
  }
  return true;
}

function clearRevokedTokens() {
  for (const [jti, expiry] of revokedTokens) {
    if (expiry <= Date.now()) revokedTokens.delete(jti);
  }
}

module.exports = { revokeToken, isTokenRevoked, clearRevokedTokens };
