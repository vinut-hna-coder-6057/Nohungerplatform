const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema({
  donorEmail: String,
  location: { type: String, index: true },
  foodDetails: String,
  image: String,
  expiryTime: Date,
  status: {
    type: String,
    default: "available"
  }
}, { timestamps: true });

module.exports = mongoose.model("Donation", donationSchema);
