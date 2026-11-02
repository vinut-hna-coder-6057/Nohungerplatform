jest.mock("../models/User", () => ({
  findOne: jest.fn(() => ({
    select: jest.fn(() => Promise.resolve({ tokenVersion: 0, disabled: false }))
  }))
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const { clearRateLimits } = require("../middleware/rateLimit");
const { clearRevokedTokens } = require("../utils/authState");

process.env.JWT_SECRET = "security-tests-only";
User.updateOne = jest.fn(() => Promise.resolve({ matchedCount: 1 }));

function token(jti = `test-${Date.now()}`) {
  return jwt.sign({
    email: "security@example.test",
    jti,
    tokenVersion: 0
  }, process.env.JWT_SECRET, { expiresIn: "5m" });
}

beforeEach(() => {
  clearRateLimits();
  clearRevokedTokens();
  jest.clearAllMocks();
});

test("logout revokes the current REST token", async () => {
  const authToken = token();
  const logout = await request(app)
    .post("/api/logout")
    .set("Authorization", `Bearer ${authToken}`);
  expect(logout.status).toBe(200);

  const profile = await request(app)
    .get("/api/profile/security@example.test")
    .set("Authorization", `Bearer ${authToken}`);
  expect(profile.status).toBe(401);
});

test("expired tokens are rejected", async () => {
  const expired = jwt.sign({
    email: "security@example.test",
    jti: "expired-token"
  }, process.env.JWT_SECRET, { expiresIn: -1 });
  const response = await request(app)
    .get("/api/profile/security@example.test")
    .set("Authorization", `Bearer ${expired}`);
  expect(response.status).toBe(401);
});

test("login rate limit returns 429", async () => {
  const responses = await Promise.all(
    Array.from({ length: 11 }, () => request(app).post("/api/login").send({}))
  );
  expect(responses.slice(0, 10).every(response => response.status === 400)).toBe(true);
  expect(responses[10].status).toBe(429);
});

test("invalid image signatures are rejected", async () => {
  const response = await request(app)
    .post("/api/donate")
    .set("Authorization", `Bearer ${token("upload-test")}`)
    .field("location", "test city")
    .field("foodDetails", "Rice")
    .attach("image", Buffer.from("not an image"), "meal.png");
  expect(response.status).toBe(400);
  expect(response.body.message).toMatch(/invalid image/i);
});
