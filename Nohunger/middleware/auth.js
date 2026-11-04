const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");
const { isTokenRevoked } = require("../utils/authState");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const token = authHeader.slice(7);
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }

  if (!decoded.email || typeof decoded.email !== "string" ||
      isTokenRevoked(decoded.jti)) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }

  if (!decoded.isAdmin) {
    if (!Number.isInteger(decoded.tokenVersion)) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }

    let user;
    try {
      user = await User.findOne({ email: decoded.email.toLowerCase().trim() })
        .select("tokenVersion disabled");
    } catch (err) {
      console.error("Authentication account lookup failed:", err.name, err.code || "unknown");
      return res.status(503).json({
        success: false,
        message: "Authentication temporarily unavailable"
      });
    }

    if (!user || user.disabled || decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
  }

  req.authToken = token;
  req.user = decoded;
  next();
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
