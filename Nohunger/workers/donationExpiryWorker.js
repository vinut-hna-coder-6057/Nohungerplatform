const Donation = require("../models/Donation");
const Notification = require("../models/Notification");

let intervalId;
let expiryInProgress = false;

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
  const expiredIds = result.modifiedCount || result.nModified || 0;
  if (expiredIds > 0) {
    const expiredDonations = await Donation.find({
      status: "expired",
      expiryTime: { $lte: now }
    }).select("requestId");
    const requestIds = expiredDonations.map(donation => donation.requestId).filter(Boolean);
    if (requestIds.length) {
      await Notification.updateMany(
        {
          requestId: { $in: requestIds },
          status: { $nin: ["completed", "declined", "expired"] }
        },
        {
          $set: { status: "expired", requestState: "expired" },
          $push: { history: { status: "expired", at: now } }
        }
      );
    }
  }
  return result;
}

function startDonationExpiryWorker(intervalMs = 60000) {
  if (intervalId) return;
  const delay = Number(intervalMs);
  if (!Number.isFinite(delay) || delay <= 0) {
    throw new Error("Expiry worker interval must be a positive number");
  }
  const run = async () => {
    if (expiryInProgress) return;
    expiryInProgress = true;
    try {
      await expireDonations();
    } catch (err) {
      console.error("Expiry worker error:", err);
    } finally {
      expiryInProgress = false;
    }
  };
  void run();
  intervalId = setInterval(async () => {
    await run();
  }, delay);
}

function stopDonationExpiryWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = undefined;
  }
  expiryInProgress = false;
}

module.exports = {
  expireDonations,
  startDonationExpiryWorker,
  stopDonationExpiryWorker
};