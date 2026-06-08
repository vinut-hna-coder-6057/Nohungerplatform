const request = require("supertest");
const app = require("../app");
test("should reject notify without token", async () => {
  const res = await request(app)
    .post("/api/notify")
    .send({
      location: "hyderabad"
    });

  expect(res.statusCode).toBe(401);
});