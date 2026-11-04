jest.mock("../utils/jwt", () => ({
  verifyToken: jest.fn()
}));
jest.mock("../models/User", () => ({
  findOne: jest.fn()
}));

const User = require("../models/User");
const { verifyToken } = require("../utils/jwt");
const { authMiddleware } = require("../middleware/auth");
const { clearRevokedTokens } = require("../utils/authState");

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
    headers: { authorization: "Bearer test-token" }
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  clearRevokedTokens();
  verifyToken.mockReturnValue({
    email: "user@example.test",
    jti: "test-token-id",
    tokenVersion: 0
  });
  User.findOne.mockReturnValue({
    select: jest.fn().mockResolvedValue({ tokenVersion: 0, disabled: false })
  });
});

test("accepts a valid token for an enabled account", async () => {
  const req = request();
  const res = response();
  const next = jest.fn();

  await authMiddleware(req, res, next);

  expect(next).toHaveBeenCalledTimes(1);
  expect(req.user.email).toBe("user@example.test");
});

test("continues rejecting invalid tokens with HTTP 401", async () => {
  verifyToken.mockImplementation(() => {
    throw new Error("invalid token");
  });
  const res = response();

  await authMiddleware(request(), res, jest.fn());

  expect(res.statusCode).toBe(401);
  expect(res.body.message).toBe("Invalid or expired token");
  expect(User.findOne).not.toHaveBeenCalled();
});

test("returns HTTP 503 rather than misclassifying account database failures as invalid tokens", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  User.findOne.mockReturnValue({
    select: jest.fn().mockRejectedValue(new Error("private database details"))
  });
  const res = response();

  await authMiddleware(request(), res, jest.fn());

  expect(res.statusCode).toBe(503);
  expect(res.body).toEqual({
    success: false,
    message: "Authentication temporarily unavailable"
  });
  expect(JSON.stringify(res.body)).not.toContain("private database details");
  log.mockRestore();
});

test("continues rejecting disabled accounts with HTTP 401", async () => {
  User.findOne.mockReturnValue({
    select: jest.fn().mockResolvedValue({ tokenVersion: 0, disabled: true })
  });
  const res = response();

  await authMiddleware(request(), res, jest.fn());

  expect(res.statusCode).toBe(401);
  expect(res.body.message).toBe("Invalid or expired token");
});
