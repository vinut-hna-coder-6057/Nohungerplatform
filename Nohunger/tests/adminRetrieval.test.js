jest.mock("../models/User", () => ({
  countDocuments: jest.fn(),
  find: jest.fn(),
  findByIdAndDelete: jest.fn()
}));
jest.mock("../models/Notification", () => ({
  countDocuments: jest.fn()
}));
jest.mock("../models/Donation", () => ({
  countDocuments: jest.fn(),
  find: jest.fn()
}));

const User = require("../models/User");
const Notification = require("../models/Notification");
const Donation = require("../models/Donation");
const adminController = require("../controllers/adminController");
const { getLeaderboard } = require("../controllers/userController");

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

test.each([
  ["dashboard statistics", adminController.getStats, () => {
    User.countDocuments.mockRejectedValue(new Error("private database details"));
  }, "Unable to fetch dashboard stats"],
  ["admin user list", adminController.getUsers, () => {
    User.find.mockReturnValue({
      select: () => ({ sort: jest.fn().mockRejectedValue(new Error("private database details")) })
    });
  }, "Unable to fetch users"],
  ["admin donation list", adminController.getDonations, () => {
    Donation.find.mockReturnValue({
      sort: jest.fn().mockRejectedValue(new Error("private database details"))
    });
  }, "Unable to fetch donations"],
  ["admin user deletion", adminController.deleteUser, () => {
    User.findByIdAndDelete.mockRejectedValue(new Error("private database details"));
  }, "Unable to delete user"],
  ["public leaderboard", getLeaderboard, () => {
    User.find.mockReturnValue({
      sort: () => ({ limit: jest.fn().mockRejectedValue(new Error("private database details")) })
    });
  }, "Unable to fetch leaderboard"]
])("returns a generic server error when %s database operation fails", async (_operation, handler, fail, message) => {
  fail();
  const res = response();

  await handler({ params: { id: "test-id" } }, res);

  expect(res.statusCode).toBe(500);
  expect(res.body).toEqual({ success: false, message });
  expect(JSON.stringify(res.body)).not.toContain("private database details");
});
