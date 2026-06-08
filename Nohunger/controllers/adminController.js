const User = require("../models/User");
const Notification = require("../models/Notification");
const Donation = require("../models/Donation");

exports.getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalNotifications = await Notification.countDocuments();
    const totalDonations = await Donation.countDocuments();
    const expired = await Donation.countDocuments({ status: "expired" });

    res.json({
      totalUsers,
      totalNotifications,
      totalDonations,
      expired
    });

  } catch (err) {
    console.error("Admin stats error:", err);
    res.json({});
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch {
    res.json([]);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
  success:false,
  message:"User not found"
});
    }

    res.json({ success: true });
  } catch (err) {
   
    res.json({ success: false });
  }
};

exports.getDonations = async (req, res) => {
  try {
    const data = await Donation.find().sort({ createdAt: -1 });
    res.json(data);
  } catch {
    res.json([]);
  }
};
