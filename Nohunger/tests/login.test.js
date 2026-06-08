const request = require("supertest");
const app = require("../app");

test("should reject short password", async () => {
  const res = await request(app)
    .post("/api/register")
    .send({
      name: "Test",
      email: "test@gmail.com",
      password: "123"
    });

  expect(res.statusCode).toBe(400);
  expect(res.body.success).toBe(false);
});