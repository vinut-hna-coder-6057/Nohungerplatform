const Donation = require("../models/Donation");

let intervalId;

async function expireDonations() {
  const now = new Date();
  const result = await Donation.updateMany(
    {
      status: "available",
      expiryTime: { $lte: now }
    },
    {
      $set: { status: "expired" }
    }
  );
  return result;
}

function startDonationExpiryWorker(intervalMs = 60000) {
  if (intervalId) return;
  intervalId = setInterval(async () => {
    try {
      await expireDonations();
    } catch (err) {
      console.error("Expiry worker error:", err);
    }
  }, 60000);
}

function stopDonationExpiryWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = undefined;
  }
}

module.exports = {
  expireDonations,
  startDonationExpiryWorker,
  stopDonationExpiryWorker
};