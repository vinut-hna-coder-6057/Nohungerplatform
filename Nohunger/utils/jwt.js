const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

function signUserToken(email, extra = {}) {
  const payload = {
    email: email.toLowerCase().trim(),
    isAdmin: false,
    jti: randomUUID()
  };

  if (extra.role) payload.role = extra.role.toLowerCase().trim();
  if (extra.location) payload.location = extra.location.toLowerCase().trim();

  payload.tokenVersion = Number.isInteger(extra.tokenVersion) ? extra.tokenVersion : 0;
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

function signAdminToken(email) {
  return jwt.sign(
    { email: email.toLowerCase().trim(), isAdmin: true, jti: randomUUID() },
    getJwtSecret(),
    { expiresIn: "12h" }
  );
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = {
  signUserToken,
  signAdminToken,
  verifyToken
};
