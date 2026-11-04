jest.mock("../models/User", () => ({
  findOne: jest.fn()
}));
jest.mock("../models/Notification", () => ({
  aggregate: jest.fn()
}));

const User = require("../models/User");
const Notification = require("../models/Notification");
const { getNotifications } = require("../controllers/notificationController");

function response() {
  const res = {
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
  return res;
}

function request(role = "receiver", location = "north city") {
  return {
    params: { role, location },
    user: { email: "receiver@example.test" }
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  User.findOne.mockResolvedValue({
    role: "receiver",
    location: "north city"
  });
  Notification.aggregate.mockResolvedValue([]);
});

test("returns HTTP 200 with an empty array when there are no notifications", async () => {
  const res = response();

  await getNotifications(request(), res);

  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual([]);
});

test("preserves successful notification payloads and role/location authorization", async () => {
  const items = [{ requestId: "NH-1", message: "Meals available" }];
  Notification.aggregate.mockResolvedValue(items);
  const res = response();

  await getNotifications(request(), res);

  expect(res.statusCode).toBe(200);
  expect(res.body).toBe(items);

  const forbidden = response();
  await getNotifications(request("ngo", "south city"), forbidden);
  expect(forbidden.statusCode).toBe(403);
  expect(Notification.aggregate).toHaveBeenCalledTimes(1);
});

test.each([
  ["user lookup", () => User.findOne.mockRejectedValue(new Error("private db details"))],
  ["aggregation", () => Notification.aggregate.mockRejectedValue(new Error("private db details"))]
])("returns a generic server error when notification %s fails", async (_operation, fail) => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  fail();
  const res = response();

  await getNotifications(request(), res);

  expect(res.statusCode).toBe(500);
  expect(res.body).toEqual({
    success: false,
    message: "Unable to fetch notifications"
  });
  expect(JSON.stringify(res.body)).not.toContain("private db details");
  log.mockRestore();
});
