const Donation = require("../models/Donation");
const User = require("../models/User");
const { deleteUploadedFile } = require("../config/multer");

exports.createDonation = async (req, res) => {
  let donationPersisted = false;
  try {
    const { location, foodDetails, expiryHours } = req.body;
    const donorEmail = req.user.email.toLowerCase().trim();
    const donor = await User.findOne({ email: donorEmail }).select("role location disabled");

    if (!donor || donor.disabled) {
      deleteUploadedFile(req.file?.path);
      return res.status(401).json({ success: false, message: "Account unavailable" });
    }
    if (donor.role?.toLowerCase() !== "donor") {
      deleteUploadedFile(req.file?.path);
      return res.status(403).json({ success: false, message: "Donor access required" });
    }

    if (typeof location !== "string" || location.trim().length < 2 ||
        typeof foodDetails !== "string" || !foodDetails.trim()) {
      deleteUploadedFile(req.file?.path);
      return res.status(400).json({ success: false, message: "Location and food details are required" });
    }
    if (location.toLowerCase().trim() !== donor.location?.toLowerCase().trim()) {
      deleteUploadedFile(req.file?.path);
      return res.status(403).json({ success: false, message: "Donation location must match your registered location" });
    }

    const hours = Number(expiryHours || 2);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 168) {
      deleteUploadedFile(req.file?.path);
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
    donationPersisted = true;

    res.status(201).json({ success: true, donationId: donation._id });

  } catch (err) {
    if (!donationPersisted) {
      deleteUploadedFile(req.file?.path);
    }
    console.error("❌ donate error:", err.message);
    res.status(500).json({ success: false, message: "Unable to create donation" });
  }
};

exports.getDonationsByLocation = async (req, res) => {
  try {
    const location = String(req.params.location || "").toLowerCase().trim();
    if (!location) return res.status(400).json({ success: false, message: "Location is required" });
    const user = await User.findOne({
      email: req.user.email.toLowerCase().trim()
    }).select("role location disabled");
    if (!user || user.disabled) {
      return res.status(401).json({ success: false, message: "Account unavailable" });
    }
    if (!["receiver", "ngo"].includes(user.role?.toLowerCase())) {
      return res.status(403).json({ success: false, message: "Receiver or NGO access required" });
    }
    if (location !== user.location?.toLowerCase().trim()) {
      return res.status(403).json({ success: false, message: "Location access denied" });
    }

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
