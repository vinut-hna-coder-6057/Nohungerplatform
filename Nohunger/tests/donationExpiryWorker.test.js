jest.mock("../models/Donation", () => ({
  updateMany: jest.fn(),
  find: jest.fn()
}));
jest.mock("../models/Notification", () => ({
  updateMany: jest.fn()
}));

const Donation = require("../models/Donation");
const Notification = require("../models/Notification");
const {
  expireDonations,
  startDonationExpiryWorker,
  stopDonationExpiryWorker
} = require("../workers/donationExpiryWorker");

describe("Donation expiry worker", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    Donation.updateMany.mockResolvedValue({ modifiedCount: 0 });
    Donation.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([])
    });
    Notification.updateMany.mockResolvedValue({ modifiedCount: 0 });
  });

  afterEach(() => {
    stopDonationExpiryWorker();
    jest.useRealTimers();
  });

  test("expires linked notifications when donations expire", async () => {
    Donation.updateMany.mockResolvedValue({ modifiedCount: 1 });
    Donation.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ requestId: "NH-123" }])
    });

    await expireDonations();

    expect(Notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: { $in: ["NH-123"] } }),
      expect.objectContaining({
        $set: { status: "expired", requestState: "expired" }
      })
    );
  });

  test("uses the configured interval and performs an immediate pass", async () => {
    startDonationExpiryWorker(2500);
    await Promise.resolve();
    await Promise.resolve();

    expect(Donation.updateMany).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(2499);
    expect(Donation.updateMany).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(Donation.updateMany).toHaveBeenCalledTimes(2);
  });
});
