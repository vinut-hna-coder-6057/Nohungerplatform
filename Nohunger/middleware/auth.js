const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");
const { isTokenRevoked } = require("../utils/authState");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (!decoded.email || typeof decoded.email !== "string") {
      throw new Error("Token subject is missing");
    }
    if (isTokenRevoked(decoded.jti)) throw new Error("Token revoked");
    if (!decoded.isAdmin) {
      if (!Number.isInteger(decoded.tokenVersion)) throw new Error("Token version missing");
      const user = await User.findOne({ email: decoded.email.toLowerCase().trim() })
        .select("tokenVersion disabled");
      if (!user || user.disabled ||
          (Number.isInteger(decoded.tokenVersion) && decoded.tokenVersion !== user.tokenVersion)) {
        throw new Error("Account unavailable");
      }
    }
    req.authToken = token;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
}

function requireSelfEmail(req, res, next) {
  const paramEmail = (req.params.email || "").toLowerCase().trim();
  const tokenEmail = (req.user?.email || "").toLowerCase().trim();

  if (paramEmail !== tokenEmail) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  next();
}

module.exports = {
  authMiddleware,
  adminMiddleware,
  requireSelfEmail
};
