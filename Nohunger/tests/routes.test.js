const request = require("supertest");
const app = require("../app");

test("should return 404 for unknown route", async () => {
  const res = await request(app)
    .get("/this-route-does-not-exist");

  expect(res.statusCode).toBe(404);
});