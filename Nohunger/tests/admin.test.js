const request = require("supertest");
const app = require("../app");

test("should return admin unavailable when env is missing", async () => {
  const res = await request(app)
    .post("/api/admin/login")
    .send({
      email: "fake@admin.com",
      password: "wrong"
    });

  expect([401, 500]).toContain(res.statusCode);
});