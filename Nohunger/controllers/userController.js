const User = require("../models/User");
const Notification = require("../models/Notification");
const sendMail = require("../utils/mail");
const { signUserToken } = require("../utils/jwt");

exports.registerRole = async (req, res) => {
  try {
   const { role, location } = req.body;

if (!role || !location) {
  return res.status(400).json({
    success: false,
    message: "Role and location are required"
  });
}

const allowedRoles = ["donor", "receiver", "ngo"];

if (!allowedRoles.includes(role)) {
  return res.status(400).json({
    success: false,
    message: "Invalid role"
  });
}

if (
  typeof location !== "string" ||
  location.trim().length < 2 ||
  location.trim().length > 50
) {
  return res.status(400).json({
    success: false,
    message: "Invalid location"
  });
}

const email = req.user.email;
const locLower = location.toLowerCase().trim();

const io = req.app.get("io");

    const existingUser = await User.findOne({ email });

    if (!existingUser) {
      return res.status(400).json({ success: false });
    }

    existingUser.role = role;
    existingUser.location = locLower;
    await existingUser.save();

    try {
      const subject = "Role Activated ✅ No Hunger";
      const html = `
        <h2>Role Activated</h2>
        <p>Your role has been activated successfully.</p>
        <ul>
          <li><b>Role:</b> ${role}</li>
          <li><b>Location:</b> ${location}</li>
        </ul>
        <p>You will receive realtime notifications.</p>
      `;
      await sendMail(req.user.email, subject, html);
    } catch (mailErr) {
      console.error("Mail error ignored:", mailErr.message);
    }
    const oneDayAgo = new Date();
oneDayAgo.setDate(oneDayAgo.getDate() - 1);

const existingNotifs = await Notification.find({
  role,
  location: locLower,
  status: "created",
  createdAt: { $gte: oneDayAgo }
})
.sort({ createdAt: -1 })
.limit(50);

    existingNotifs.forEach(n => {
      io.to(`${role}_${locLower}`).emit("newNotification", n);
    });

    const token = signUserToken(email, { role, location: locLower });
    res.json({ success: true, token });

  } catch (err) {
    console.error("❌ registerRole error:", err.message);
    res.status(500).json({ success: false });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();


    const user = await User.findOne({ email });

    if (!user) {
      return res.status(500).json({
  success: false,
  message: "Server error"
});
    }

    res.json({
      success: true,
      name: user.name || "Not Available",
      role: user.role || "Not Set",
      location: user.location || "Not Set",
      donations: user.donationsCount || 0,
      received: user.receivedCount || 0,
      services: user.ngoServices || 0
    });

  } catch (err) {
    console.error("❌ PROFILE ERROR:", err);
    res.json({ success: false });
  }
};
exports.getMyActivity = async (req, res) => {
  const email = req.params.email.toLowerCase().trim();

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.json([]);
    }

    const data = await Notification.find({
      $or: [
        { senderEmail: email },
        { handler: email }
      ]
    }).sort({ createdAt: -1 });

    res.json(data);

  } catch (err) {
    console.error("Activity error:", err);
    res.json([]);
  }
};
exports.getLeaderboard = async (req, res) => {
  try {
    const users = await User.find({ donationsCount: { $gt: 0 } })
      .sort({ donationsCount: -1 })
      .limit(10);

    const data = users.map(u => ({
      name: u.name || "Anonymous",
      location: u.location || "-",
      donations: u.donationsCount
    }));

    res.json(data);

  } catch (err) {
    console.error("Leaderboard error:", err);
    res.json([]);
  }
};
