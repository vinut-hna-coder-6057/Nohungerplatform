const request = require("supertest");
const app = require("../app");

test("should reject profile access without token", async () => {
  const res = await request(app)
    .get("/api/profile/fake@gmail.com");

  expect(res.statusCode).toBe(401);
});