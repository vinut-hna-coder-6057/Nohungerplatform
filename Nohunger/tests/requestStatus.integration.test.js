const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app");
const Notification = require("../models/Notification");
const User = require("../models/User");

const mongoTestUri = process.env.MONGO_TEST_URI;
const describeWithMongo = mongoTestUri ? describe : describe.skip;
const jwtSecret = "no-hunger-transaction-tests-only";
const sessions = [];
const originalStartSession = mongoose.startSession.bind(mongoose);
process.env.JWT_SECRET = jwtSecret;

function token(email) {
  return jwt.sign({ email }, jwtSecret, { expiresIn: "5m" });
}

function statusRequest(email, requestId, status = "received") {
  return request(app)
    .post("/api/update-status")
    .set("Authorization", `Bearer ${token(email)}`)
    .send({ requestId, status });
}

async function seedCompletion({ donorEmail = "donor@example.test", requestId = "txn-request" } = {}) {
  await User.create([
    { email: "donor@example.test", password: "test-only", role: "donor", location: "north city" },
    { email: "receiver@example.test", password: "test-only", role: "receiver", location: "north city" }
  ]);
  await Notification.create({
    requestId,
    role: "receiver",
    fromRole: "donor",
    senderEmail: "donor@example.test",
    donorEmail,
    receiverEmail: "receiver@example.test",
    location: "north city",
    status: "accepted",
    requestState: "ready_to_receive",
    donorName: "Test donor",
    foodItem: "Rice",
    quantity: "4 meals",
    foodType: "veg"
  });
  return requestId;
}

async function seedClaimRequest() {
  await User.create([
    { email: "donor@example.test", password: "test-only", role: "donor", location: "north city" },
    { email: "receiver-a@example.test", password: "test-only", role: "receiver", location: "north city" },
    { email: "receiver-b@example.test", password: "test-only", role: "receiver", location: "north city" }
  ]);
  await Notification.create({
    requestId: "txn-claim",
    role: "receiver",
    fromRole: "donor",
    senderEmail: "donor@example.test",
    donorEmail: "donor@example.test",
    location: "north city",
    status: "created",
    requestState: "receiver_deciding"
  });
}

describeWithMongo("request completion transaction integration", () => {
  beforeAll(async () => {
    const parsedUri = new URL(mongoTestUri);
    if (!["localhost", "127.0.0.1"].includes(parsedUri.hostname) || parsedUri.pathname !== "/nohunger_test") {
      throw new Error("MONGO_TEST_URI must point to the isolated local nohunger_test database");
    }
    await mongoose.connect(mongoTestUri, { serverSelectionTimeoutMS: 5000 });
    jest.spyOn(mongoose, "startSession").mockImplementation(async (...args) => {
      const session = await originalStartSession(...args);
      sessions.push(session);
      return session;
    });
  });

  beforeEach(async () => {
    sessions.length = 0;
    await Promise.all([User.deleteMany({}), Notification.deleteMany({})]);
  });

  afterEach(() => {
    expect(sessions.every(session => session.hasEnded)).toBe(true);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (mongoose.connection.readyState !== 0) {
      await Promise.all([User.deleteMany({}), Notification.deleteMany({})]);
      await mongoose.disconnect();
    }
  });

  test("completion commits state, participant counters, and donor notification", async () => {
    const requestId = await seedCompletion();

    const response = await statusRequest("receiver@example.test", requestId);

    expect(response.status).toBe(200);
    expect(await Notification.findOne({ requestId, role: "receiver" })).toMatchObject({
      status: "completed",
      requestState: "completed"
    });
    expect(await User.findOne({ email: "donor@example.test" })).toMatchObject({ donationsCount: 1 });
    expect(await User.findOne({ email: "receiver@example.test" })).toMatchObject({ receivedCount: 1 });
    expect(await Notification.countDocuments({ requestId, role: "donor", requestState: "completed" })).toBe(1);
  });

  test("concurrent receivers cannot both claim the same request in MongoDB", async () => {
    await seedClaimRequest();

    const responses = await Promise.all([
      statusRequest("receiver-a@example.test", "txn-claim", "receiver_accepted"),
      statusRequest("receiver-b@example.test", "txn-claim", "receiver_accepted")
    ]);

    expect(responses.map(response => response.status).sort()).toEqual([200, 404]);
    expect(await Notification.findOne({ requestId: "txn-claim" })).toMatchObject({
      status: "accepted",
      requestState: "choose_delivery",
      receiverEmail: expect.stringMatching(/^receiver-[ab]@example\.test$/)
    });

    const repeated = await statusRequest("receiver-a@example.test", "txn-claim", "receiver_accepted");
    expect(repeated.status).toBe(404);
  });

  test("a missing participant aborts all state and counter changes", async () => {
    const requestId = await seedCompletion({ donorEmail: "missing@example.test", requestId: "txn-rollback" });

    const response = await statusRequest("receiver@example.test", requestId);

    expect(response.status).toBe(500);
    expect(await Notification.findOne({ requestId, role: "receiver" })).toMatchObject({
      status: "accepted",
      requestState: "ready_to_receive"
    });
    expect(await User.findOne({ email: "receiver@example.test" })).toMatchObject({ receivedCount: 0 });
    expect(await Notification.countDocuments({ requestId, role: "donor" })).toBe(0);
  });

  test("concurrent completion attempts increment counters and notify exactly once", async () => {
    const requestId = await seedCompletion({ requestId: "txn-concurrent" });

    const responses = await Promise.all([
      statusRequest("receiver@example.test", requestId),
      statusRequest("receiver@example.test", requestId)
    ]);

    expect(responses.map(response => response.status).sort()).toEqual([200, 404]);
    expect(await User.findOne({ email: "donor@example.test" })).toMatchObject({ donationsCount: 1 });
    expect(await User.findOne({ email: "receiver@example.test" })).toMatchObject({ receivedCount: 1 });
    expect(await Notification.countDocuments({ requestId, role: "donor", requestState: "completed" })).toBe(1);
  });
});
