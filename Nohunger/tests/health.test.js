const request = require("supertest");
const app = require("../app");

describe("Health Endpoint", () => {

  test("GET /health should return UP", async () => {

    const res = await request(app)
      .get("/health");

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("UP");

  });

});