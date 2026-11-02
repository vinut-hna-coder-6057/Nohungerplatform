const Donation = require("../models/Donation");
const fs = require("fs");

exports.createDonation = async (req, res) => {
  try {
    const { location, foodDetails, expiryHours } = req.body;
    const donorEmail = req.user.email.toLowerCase().trim();

    if (typeof location !== "string" || location.trim().length < 2 ||
        typeof foodDetails !== "string" || !foodDetails.trim()) {
      return res.status(400).json({ success: false, message: "Location and food details are required" });
    }

    const hours = Number(expiryHours || 2);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 168) {
      return res.status(400).json({ success: false, message: "Expiry must be between 1 and 168 hours" });
    }

    const expiryTime = new Date(Date.now() + hours * 60 * 60 * 1000);

    const donation = new Donation({
      donorEmail,
      location: location.toLowerCase(),
      foodDetails: foodDetails.trim(),
      image: req.file ? req.file.filename : null,
      expiryTime
    });

    await donation.save();

    res.status(201).json({ success: true, donationId: donation._id });

  } catch (err) {
    if (req.file?.path) fs.rmSync(req.file.path, { force: true });
    console.error("❌ donate error:", err.message);
    res.status(500).json({ success: false, message: "Unable to create donation" });
  }
};

exports.getDonationsByLocation = async (req, res) => {
  try {
    const location = String(req.params.location || "").toLowerCase().trim();
    if (!location) return res.status(400).json({ success: false, message: "Location is required" });

    const data = await Donation.find({
      location,
      status: "available",
      expiryTime: { $gt: new Date() }
    }).sort({ createdAt: -1 }).lean();

    res.json(data);

  } catch (err) {
    console.error("❌ fetch donations error:", err.message);
    res.status(500).json({ success: false, message: "Unable to fetch donations" });
  }
};
