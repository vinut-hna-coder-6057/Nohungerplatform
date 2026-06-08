const request = require("supertest");
const app = require("../app");

test("should reject update-status without status", async () => {
  const res = await request(app)
    .post("/api/update-status")
    .send({
      requestId: "123"
    });

  expect([400, 401]).toContain(res.statusCode);
});