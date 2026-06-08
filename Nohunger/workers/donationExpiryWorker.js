const Donation = require("../models/Donation");

let intervalId;

function startDonationExpiryWorker() {
  intervalId = setInterval(async () => {
    try {
      const now = new Date();

      await Donation.updateMany(
        {
          status: "available",
          expiryTime: { $lt: now }
        },
        {
          $set: { status: "expired" }
        }
      );

    } catch (err) {
      console.error("Expiry worker error:", err);
    }
  }, 60000);
}

function stopDonationExpiryWorker() {
  if (intervalId) {
    clearInterval(intervalId);
  }
}

module.exports = {
  startDonationExpiryWorker,
  stopDonationExpiryWorker
};