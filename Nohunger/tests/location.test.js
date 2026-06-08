const request = require("supertest");
const app = require("../app");

test("should reject invalid coordinates", async () => {
  const res = await request(app)
    .post("/api/save-receiver-location")
    .send({
      requestId: "123",
      lat: "abc",
      lng: "xyz"
    });

  expect([400, 401]).toContain(res.statusCode);
});