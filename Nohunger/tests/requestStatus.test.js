jest.mock("../models/User", () => ({
  findOne: jest.fn(),
  updateOne: jest.fn()
}));

jest.mock("../models/Notification", () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  insertMany: jest.fn(),
  updateMany: jest.fn(),
  updateOne: jest.fn()
}));

const http = require("http");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { io: createSocketClient } = require("socket.io-client");
const User = require("../models/User");
const Notification = require("../models/Notification");
const app = require("../app");
const initSocket = require("../socket");

const JWT_SECRET = "request-status-tests-only";
process.env.JWT_SECRET = JWT_SECRET;

const users = new Map();
const records = [];
const session = {
  withTransaction: jest.fn(async callback => callback()),
  endSession: jest.fn()
};

function token(email) {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: "5m" });
}

function matches(record, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = record[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      if (Object.prototype.hasOwnProperty.call(expected, "$ne")) return actual !== expected.$ne;
      if (Object.prototype.hasOwnProperty.call(expected, "$in")) return expected.$in.includes(actual);
      if (Object.prototype.hasOwnProperty.call(expected, "$exists")) return (actual !== undefined) === expected.$exists;
    }
    if (expected === null) return actual == null;
    return actual === expected;
  });
}

function applyUpdate(record, update) {
  Object.assign(record, update.$set || {});
  if (update.$push?.history) record.history = [...(record.history || []), update.$push.history];
}

function seedRequest(overrides = {}) {
  const record = {
    _id: `request-${records.length + 1}`,
    requestId: "request-1",
    role: "receiver",
    fromRole: "donor",
    senderEmail: "donor@example.test",
    donorEmail: "donor@example.test",
    receiverEmail: null,
    location: "north city",
    status: "created",
    requestState: "receiver_deciding",
    history: [],
    foodItem: "Rice",
    quantity: "4 meals",
    foodType: "veg",
    donorName: "Donor",
    ...overrides
  };
  records.push(record);
  return record;
}

function setupUsers() {
  users.clear();
  users.set("donor@example.test", { email: "donor@example.test", role: "donor", location: "north city", donationsCount: 0 });
  users.set("receiver-a@example.test", { email: "receiver-a@example.test", role: "receiver", location: "north city", receivedCount: 0 });
  users.set("receiver-b@example.test", { email: "receiver-b@example.test", role: "receiver", location: "north city", receivedCount: 0 });
  users.set("receiver-other@example.test", { email: "receiver-other@example.test", role: "receiver", location: "south city", receivedCount: 0 });
  users.set("ngo@example.test", { email: "ngo@example.test", role: "ngo", location: "north city", ngoServices: 0 });

  User.findOne.mockImplementation(({ email }) => ({
    select: () => Promise.resolve(users.get(email) || null)
  }));
  User.updateOne.mockImplementation(({ email }, update) => {
    const user = users.get(email);
    if (!user) return Promise.resolve({ matchedCount: 0 });
    for (const [field, amount] of Object.entries(update.$inc || {})) user[field] = (user[field] || 0) + amount;
    return Promise.resolve({ matchedCount: 1 });
  });
}

function setupNotificationStore() {
  Notification.findOneAndUpdate.mockImplementation((filter, update) => {
    const record = records.find(item => matches(item, filter));
    if (!record) return Promise.resolve(null);
    applyUpdate(record, update);
    return Promise.resolve({ ...record, history: [...record.history] });
  });
  Notification.updateMany.mockImplementation((filter, update) => {
    const matched = records.filter(record => matches(record, filter));
    matched.forEach(record => applyUpdate(record, update));
    return Promise.resolve({ matchedCount: matched.length });
  });
  Notification.updateOne.mockImplementation((filter, update) => {
    const record = records.find(item => matches(item, filter));
    if (!record) return Promise.resolve({ matchedCount: 0 });
    applyUpdate(record, update);
    return Promise.resolve({ matchedCount: 1 });
  });
  Notification.findOne.mockImplementation(filter => {
    const found = records.find(record => matches(record, filter)) || null;
    const result = Promise.resolve(found && { ...found, history: [...found.history] });
    result.session = () => result;
    return result;
  });
  Notification.create.mockImplementation(documents => {
    const created = documents.map((document, index) => ({ _id: `created-${records.length + index + 1}`, ...document }));
    records.push(...created);
    return Promise.resolve(created);
  });
}

function setIo(io = { to: jest.fn(() => ({ emit: jest.fn() })), emit: jest.fn() }) {
  app.set("io", io);
  return io;
}

beforeEach(() => {
  records.length = 0;
  jest.clearAllMocks();
  setupUsers();
  setupNotificationStore();
  session.withTransaction.mockImplementation(async callback => callback());
  jest.spyOn(mongoose, "startSession").mockResolvedValue(session);
  setIo();
});

afterEach(() => {
  jest.restoreAllMocks();
});

const statusRequest = (email, body) => request(app)
  .post("/api/update-status")
  .set("Authorization", `Bearer ${token(email)}`)
  .send(body);

test("an eligible same-location receiver atomically accepts and owns the request", async () => {
  const record = seedRequest();
  const response = await statusRequest("receiver-a@example.test", {
    requestId: record.requestId,
    status: "receiver_accepted"
  });

  expect(response.status).toBe(200);
  expect(record).toMatchObject({ status: "accepted", requestState: "choose_delivery", receiverEmail: "receiver-a@example.test" });
  expect(Notification.findOneAndUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ receiverEmail: null, location: "north city", requestState: "receiver_deciding" }),
    expect.any(Object),
    expect.objectContaining({ new: true, session })
  );
});

test("an unrelated receiver cannot accept a request from another location", async () => {
  const record = seedRequest();
  const response = await statusRequest("receiver-other@example.test", {
    requestId: record.requestId,
    status: "receiver_accepted"
  });

  expect(response.status).toBe(404);
  expect(record.receiverEmail).toBeNull();
  expect(record.requestState).toBe("receiver_deciding");
});

test("a donor cannot perform a receiver-only transition", async () => {
  seedRequest();
  const response = await statusRequest("donor@example.test", {
    requestId: "request-1",
    status: "receiver_accepted"
  });
  expect(response.status).toBe(403);
  expect(Notification.findOneAndUpdate).not.toHaveBeenCalled();
});

test("missing authentication is rejected", async () => {
  const response = await request(app).post("/api/update-status").send({ requestId: "request-1", status: "receiver_accepted" });
  expect(response.status).toBe(401);
});

test("missing requests and invalid transitions are rejected without mutation", async () => {
  const absent = await statusRequest("receiver-a@example.test", { requestId: "missing", status: "receiver_accepted" });
  expect(absent.status).toBe(404);

  const record = seedRequest({ requestState: "choose_delivery", status: "accepted", receiverEmail: "receiver-a@example.test" });
  const invalid = await statusRequest("receiver-a@example.test", { requestId: record.requestId, status: "receiver_accepted" });
  expect(invalid.status).toBe(404);
  expect(record.requestState).toBe("choose_delivery");
});

test("repeated and concurrent acceptance attempts assign only one receiver", async () => {
  const record = seedRequest();
  const [first, second] = await Promise.all([
    statusRequest("receiver-a@example.test", { requestId: record.requestId, status: "receiver_accepted" }),
    statusRequest("receiver-b@example.test", { requestId: record.requestId, status: "receiver_accepted" })
  ]);
  expect([first.status, second.status].sort()).toEqual([200, 404]);
  expect(["receiver-a@example.test", "receiver-b@example.test"]).toContain(record.receiverEmail);

  const repeat = await statusRequest("receiver-a@example.test", { requestId: record.requestId, status: "receiver_accepted" });
  expect(repeat.status).toBe(404);
});

test("self-collection creates a donor notification inside the transaction", async () => {
  const record = seedRequest({
    status: "accepted",
    requestState: "choose_delivery",
    receiverEmail: "receiver-a@example.test"
  });
  const response = await statusRequest("receiver-a@example.test", { requestId: record.requestId, status: "self_collect" });

  expect(response.status).toBe(200);
  expect(record.requestState).toBe("self_collect_started");
  expect(records).toEqual(expect.arrayContaining([
    expect.objectContaining({ role: "donor", donorEmail: "donor@example.test", receiverEmail: "receiver-a@example.test" })
  ]));
  expect(session.withTransaction).toHaveBeenCalledTimes(1);
});

test("the transaction session is closed when a transition fails", async () => {
  seedRequest({
    status: "accepted",
    requestState: "ready_to_receive",
    receiverEmail: "receiver-a@example.test"
  });
  session.withTransaction.mockRejectedValueOnce(new Error("transaction failed"));

  const response = await statusRequest("receiver-a@example.test", {
    requestId: "request-1",
    status: "received"
  });

  expect(response.status).toBe(500);
  expect(session.endSession).toHaveBeenCalledTimes(1);
});

test("an unauthorized socket cannot join a private request room", async () => {
  const ioServer = initSocket(http.createServer());
  const server = ioServer.httpServer;
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const client = createSocketClient(`http://127.0.0.1:${address.port}`, { auth: { token: token("receiver-b@example.test") } });
  try {
    await new Promise((resolve, reject) => {
      client.once("connect", resolve);
      client.once("connect_error", reject);
    });
    const privateRecord = seedRequest({ senderEmail: "donor@example.test", receiverEmail: "receiver-a@example.test", handler: "ngo@example.test" });
    Notification.findOne.mockImplementation(filter => Promise.resolve(records.find(record => matches(record, filter)) || null));
    const denied = new Promise(resolve => client.once("socketError", resolve));
    client.emit("joinRequestRoom", privateRecord.requestId);
    await expect(denied).resolves.toMatchObject({ message: "Access denied" });
    expect(ioServer.sockets.sockets.get(client.id).rooms.has(`request_${privateRecord.requestId}`)).toBe(false);
  } finally {
    client.close();
    await new Promise(resolve => ioServer.close(resolve));
  }
});
