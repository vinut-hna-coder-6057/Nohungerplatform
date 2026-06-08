const { verifyToken } = require("../utils/jwt");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const token = authHeader.slice(7);
    req.user = verifyToken(token);
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
