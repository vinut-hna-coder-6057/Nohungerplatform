const crypto = require("crypto");
const User = require("../models/User");
const Notification = require("../models/Notification");
exports.createNotification = async (req, res) => {
  try {
    const { details, image, foodType } = req.body;
    const email = req.user.email.toLowerCase().trim();
    const io = req.app.get("io");

    const senderUser = await User.findOne({ email });

    if (!senderUser || !senderUser.role || !senderUser.location) {
      return res.status(403).json({ success: false, message: "Choose a role and location first" });
    }

    const senderRole = senderUser.role.toLowerCase();
    const loc = senderUser.location.toLowerCase().trim();

    let allowedTargets = [];

    if (senderRole === "donor") allowedTargets = ["receiver"];
    else if (senderRole === "receiver") allowedTargets = ["donor"];
    else if (senderRole === "ngo") allowedTargets = ["receiver"];

    if (!allowedTargets.length) {
      return res.status(400).json({ success: false });
    }

    const uniquePart = crypto.randomBytes(3).toString("hex").toUpperCase();

    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, "0") +
      String(today.getDate()).padStart(2, "0");

    const cityCode = loc.substring(0, 3).toUpperCase();

    const requestId = `NH-${cityCode}-${dateStr}-${uniquePart}`;

    const docs = allowedTargets.map(targetRole => ({
      requestId,
      role: targetRole,
      fromRole: senderRole,
      senderEmail: email,
      donorEmail: senderRole === "donor" ? email : null,
      receiverEmail: senderRole === "receiver" ? email : null,
      location: loc,

      message:
        senderRole === "donor"
          ? `🍱 ${foodType?.toUpperCase() || ""} Food Available`
          : `🍽️ Food Request`,

      donorName: senderUser.name || null,

      foodItem: details?.q1 || "-",
      quantity: details?.q2 || "-",
      foodType: foodType || "Not specified",

      status: "created",
      requestState:
        senderRole === "donor"
          ? "receiver_deciding"
          : "donor_deciding",

      details: details || {},
      image: image || null,
      history: [{ status: "created", at: new Date() }]
    }));

    await Notification.insertMany(docs);

    docs.forEach(n => {
      const room = `${n.role}_${n.location}`.toLowerCase().trim();

      io.to(room).emit("newNotification", n);
    });

    res.json({ success: true, requestId });

  } catch (err) {
    console.error("❌ notify error:", err.message);
    res.status(500).json({ success: false });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const role = req.params.role.toLowerCase();
    const location = req.params.location.toLowerCase();
    const email = req.user.email;

const user = await User.findOne({
  email: email.toLowerCase().trim()
});

if (!user || !user.role || !user.location) {
  return res.json([]);
}

const dbRole = user.role.toLowerCase();
const dbLocation = user.location.toLowerCase();

if (dbRole !== role || dbLocation !== location) {
  return res.status(403).json({
    success: false,
    message: "Forbidden"
  });
}

    const data = await Notification.aggregate([
      {
        $match: {
          role,
          location
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: "$requestId",
          doc: { $first: "$$ROOT" }
        }
      },
      {
        $replaceRoot: { newRoot: "$doc" }
      }
    ]);

    res.json(data);

  } catch (err) {
    console.error("Fetch notifications error:", err.message);
    res.json([]);
  }
};
exports.saveReceiverLocation = async (req, res) => {
  try {
    const { requestId, lat, lng } = req.body || {};
    if (typeof requestId !== "string" || !requestId.trim()) {
      return res.status(400).json({ success: false, message: "Invalid request ID" });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ success: false, message: "Invalid location data" });
    }

    const email = req.user.email.toLowerCase().trim();
    const user = await User.findOne({ email }).select("role location");
    if (!user) return res.status(401).json({ success: false, message: "Account unavailable" });
    if (user.role?.toLowerCase() !== "receiver") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const location = user.location?.toLowerCase().trim();
    if (!location) return res.status(403).json({ success: false, message: "Role and location required" });

    const request = await Notification.findOne({
      requestId: requestId.trim(),
      role: "ngo",
      location,
      receiverEmail: email,
      requestState: { $in: ["waiting_for_ngo", "delivery_started", "picked_up", "on_the_way"] }
    });
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    await Notification.updateMany(
      { requestId: requestId.trim(), receiverEmail: email },
      { $set: { receiverLocation: { lat: latitude, lng: longitude } } }
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("saveReceiverLocation error:", err.message);
    return res.status(500).json({ success: false, message: "Unable to save location" });
  }
};
