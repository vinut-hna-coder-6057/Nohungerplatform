const Donation = require("../models/Donation");

exports.createDonation = async (req, res) => {
  try {
    const { location, foodDetails, expiryHours } = req.body;
    const donorEmail = req.user.email;

    if (!location || !foodDetails)
      return res.status(400).json({ success: false });

    const expiryTime = new Date(
      Date.now() + Number(expiryHours || 2) * 60 * 60 * 1000
    );

    const donation = new Donation({
      donorEmail,
      location: location.toLowerCase(),
      foodDetails,
      image: req.file ? req.file.filename : null,
      expiryTime
    });

    await donation.save();

    res.json({ success: true, donationId: donation._id });

  } catch (err) {
    console.error("❌ donate error:", err.message);
    res.status(500).json({ success: false });
  }
};

exports.getDonationsByLocation = async (req, res) => {
  try {
    const location = req.params.location.toLowerCase();

    const data = await Donation.find({
      location,
      status: "available"
    }).sort({ createdAt: -1 });

    res.json(data);

  } catch (err) {
    console.error("❌ fetch donations error:", err.message);
    res.json([]);
  }
};
