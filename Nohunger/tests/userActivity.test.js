jest.mock("../models/User", () => ({
  findOne: jest.fn()
}));
jest.mock("../models/Notification", () => ({
  find: jest.fn()
}));

const User = require("../models/User");
const Notification = require("../models/Notification");
const { getMyActivity } = require("../controllers/userController");

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

function request() {
  return {
    params: { email: "receiver@example.test" }
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  User.findOne.mockResolvedValue({ email: "receiver@example.test" });
  Notification.find.mockReturnValue({
    sort: jest.fn().mockResolvedValue([])
  });
});

test("returns a successful empty activity list when no activity exists", async () => {
  const res = response();

  await getMyActivity(request(), res);

  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual([]);
});

test("returns a generic server error when activity retrieval fails", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  Notification.find.mockReturnValue({
    sort: jest.fn().mockRejectedValue(new Error("private database details"))
  });
  const res = response();

  await getMyActivity(request(), res);

  expect(res.statusCode).toBe(500);
  expect(res.body).toEqual({
    success: false,
    message: "Unable to fetch activity"
  });
  expect(JSON.stringify(res.body)).not.toContain("private database details");
  log.mockRestore();
});
