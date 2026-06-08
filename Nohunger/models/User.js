const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: { type: String, required: true },
  role: String,
  location: String,
  donationsCount: { type: Number, default: 0 },
  receivedCount: { type: Number, default: 0 },
  ngoServices: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
