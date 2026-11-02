const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema({
  donorEmail: String,
  requestId: { type: String, unique: true, sparse: true, index: true },
  location: { type: String, index: true },
  foodDetails: String,
  quantity: String,
  foodType: String,
  image: String,
  expiryTime: Date,
  status: {
    type: String,
    default: "available"
  }
}, { timestamps: true });

donationSchema.index({ status: 1, location: 1, expiryTime: 1 });
donationSchema.index({ donorEmail: 1, createdAt: -1 });

module.exports = mongoose.model("Donation", donationSchema);
