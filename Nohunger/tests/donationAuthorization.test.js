jest.mock("../models/User", () => ({
  findOne: jest.fn()
}));
jest.mock("../models/Donation", () => ({
  find: jest.fn(),
  prototype: {}
}));

process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const { signUserToken } = require("../utils/jwt");

const tokenFor = (email, role, location) => signUserToken(email, {
  role,
  location,
  tokenVersion: 0
});

function userQuery(user) {
  return {
    select: jest.fn().mockResolvedValue(user)
  };
}

describe("Donation authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("rejects a receiver attempting to create a donation", async () => {
    User.findOne.mockReturnValue(userQuery({
      role: "receiver",
      location: "north city",
      tokenVersion: 0,
      disabled: false
    }));

    const response = await request(app)
      .post("/api/donate")
      .set("Authorization", `Bearer ${tokenFor("receiver@example.test", "receiver", "north city")}`)
      .field("location", "north city")
      .field("foodDetails", "Rice");

    expect(response.statusCode).toBe(403);
  });

  test("rejects discovery for a different registered location", async () => {
    User.findOne.mockReturnValue(userQuery({
      role: "receiver",
      location: "north city",
      tokenVersion: 0,
      disabled: false
    }));

    const response = await request(app)
      .get("/api/donations/south city")
      .set("Authorization", `Bearer ${tokenFor("receiver@example.test", "receiver", "north city")}`);

    expect(response.statusCode).toBe(403);
  });
});
