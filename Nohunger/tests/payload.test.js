const request = require("supertest");
const app = require("../app");

test("should reject oversized payload", async () => {
  const hugeString = "a".repeat(2 * 1024 * 1024);

  const res = await request(app)
    .post("/api/register")
    .send({
      name: hugeString,
      email: "test@gmail.com",
      password: "password123"
    });

  expect([400, 413]).toContain(res.statusCode);
});