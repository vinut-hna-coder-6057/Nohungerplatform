const jwt = require("jsonwebtoken");

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
    isAdmin: false
  };

  if (extra.role) payload.role = extra.role.toLowerCase().trim();
  if (extra.location) payload.location = extra.location.toLowerCase().trim();

  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

function signAdminToken(email) {
  return jwt.sign(
    { email: email.toLowerCase().trim(), isAdmin: true },
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
