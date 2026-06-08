const request = require("supertest");
const app = require("../app");

describe("Protected Routes", () => {

  test("should reject invalid role", async () => {
  const res = await request(app)
    .post("/api/registerRole")
    .send({
      role: "manager",
      location: "hyderabad"
    });

  expect([400, 401]).toContain(res.statusCode);
});

});