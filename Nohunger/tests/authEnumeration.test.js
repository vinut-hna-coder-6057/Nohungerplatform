jest.mock("../models/User", () => ({
  findOne: jest.fn()
}));
jest.mock("../utils/mail", () => jest.fn());

const request = require("supertest");
const app = require("../app");
const User = require("../models/User");

describe("Login failure responses", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("uses the same response for an unknown account and a wrong password", async () => {
    User.findOne.mockResolvedValueOnce(null);
    const unknown = await request(app)
      .post("/api/login")
      .send({ email: "missing@example.test", password: "WrongPassword123!" });

    User.findOne.mockResolvedValueOnce({
      password: "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
    });
    const wrongPassword = await request(app)
      .post("/api/login")
      .send({ email: "known@example.test", password: "WrongPassword123!" });

    expect(unknown.statusCode).toBe(401);
    expect(wrongPassword.statusCode).toBe(401);
    expect(unknown.body).toEqual(wrongPassword.body);
  });
});
