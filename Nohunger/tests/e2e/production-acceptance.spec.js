const { test, expect } = require("@playwright/test");
const { io } = require("socket.io-client");

test.describe.configure({ mode: "serial" });

const suffix = `${Date.now()}-${process.pid}`;
const password = "E2eTestPassword123!";
const location = `acceptance-${suffix}`;
const donor = {
  name: `Acceptance Donor ${suffix}`,
  email: `acceptance-donor-${suffix}@example.test`,
  password
};
const receiver = {
  name: `Acceptance Receiver ${suffix}`,
  email: `acceptance-receiver-${suffix}@example.test`,
  password
};
const ngo = {
  name: `Acceptance NGO ${suffix}`,
  email: `acceptance-ngo-${suffix}@example.test`,
  password
};

let donorToken;
let receiverToken;
let ngoToken;
let requestId;

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNgaPgPAAIDAYBxfNghAAAAAElFTkSuQmCC",
  "base64"
);

async function registerAndLogin(request, user) {
  expect((await request.post("/api/register", { data: user })).status()).toBe(200);
  const response = await request.post("/api/login", {
    data: { email: user.email, password: user.password }
  });
  expect(response.status()).toBe(200);
  return (await response.json()).token;
}

async function api(request, token, method, path, data) {
  return request[method](path, {
    headers: { Authorization: `Bearer ${token}` },
    data
  });
}

async function assignRole(request, token, role) {
  const response = await api(request, token, "post", "/api/registerRole", {
    role,
    location
  });
  expect(response.status()).toBe(200);
}

function waitForSocketConnection(socket) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error("Socket.IO connection timed out")), 5000);
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
      socket.off("error", onError);
    };
    const finish = error => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onConnect = () => finish();
    const onError = error => finish(error);

    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
    socket.once("error", onError);
  });
}

function waitForServerDisconnect(socket) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error("Socket.IO logout disconnect timed out")), 5000);
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
      socket.off("error", onError);
    };
    const finish = error => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onDisconnect = reason => {
      if (reason !== "io server disconnect") {
        finish(new Error(`Unexpected Socket.IO disconnect: ${reason}`));
        return;
      }
      finish();
    };
    const onError = error => finish(error);

    socket.once("disconnect", onDisconnect);
    socket.once("connect_error", onError);
    socket.once("error", onError);
  });
}

function expectUnauthorizedSocketRejection(token) {
  const socket = io(process.env.E2E_BASE_URL, {
    auth: { token },
    reconnection: false,
    timeout: 5000
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(
      () => finish(new Error("Socket.IO did not reject the revoked token before timeout")),
      5000
    );
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("error", onError);
      socket.close();
    };
    const finish = error => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onConnect = () => finish(new Error("Revoked token established a Socket.IO connection"));
    const onConnectError = error => {
      if (!/^unauthorized$/i.test(error.message)) {
        finish(new Error(`Unexpected Socket.IO connection error: ${error.message}`));
        return;
      }
      finish();
    };
    const onError = error => finish(error);

    socket.once("connect", onConnect);
    socket.once("connect_error", onConnectError);
    socket.once("error", onError);
  });
}

test("NGO registration, login, and delivery workflow", async ({ request }) => {
  donorToken = await registerAndLogin(request, donor);
  receiverToken = await registerAndLogin(request, receiver);
  ngoToken = await registerAndLogin(request, ngo);
  await assignRole(request, donorToken, "donor");
  await assignRole(request, receiverToken, "receiver");
  await assignRole(request, ngoToken, "ngo");

  const created = await api(request, donorToken, "post", "/api/notify", {
    details: { q1: "Prepared meals", q2: "12 portions" },
    foodType: "veg"
  });
  expect(created.status()).toBe(200);
  requestId = (await created.json()).requestId;

  expect((await api(
    request,
    receiverToken,
    "get",
    `/api/notifications/receiver/${location}`
  )).status()).toBe(200);
  expect((await api(request, receiverToken, "post", "/api/update-status", {
    requestId,
    status: "receiver_accepted"
  })).status()).toBe(200);
  expect((await api(request, receiverToken, "post", "/api/update-status", {
    requestId,
    status: "ask_ngo"
  })).status()).toBe(200);
  expect((await api(request, ngoToken, "post", "/api/update-status", {
    requestId,
    status: "ngo_accepted"
  })).status()).toBe(200);
  expect((await api(request, ngoToken, "post", "/api/update-status", {
    requestId,
    status: "picked_up"
  })).status()).toBe(200);
  expect((await api(request, ngoToken, "post", "/api/update-status", {
    requestId,
    status: "on_the_way"
  })).status()).toBe(200);
  expect((await api(request, ngoToken, "post", "/api/update-status", {
    requestId,
    status: "ngo_delivered"
  })).status()).toBe(200);

  const activity = await api(
    request,
    receiverToken,
    "get",
    `/api/my-activity/${receiver.email}`
  );
  expect(activity.status()).toBe(200);
  expect((await activity.json()).some(item =>
    item.requestId === requestId && item.requestState === "completed"
  )).toBe(true);

  const profile = await api(
    request,
    ngoToken,
    "get",
    `/api/profile/${ngo.email}`
  );
  expect(profile.status()).toBe(200);
  expect((await profile.json()).services).toBeGreaterThanOrEqual(1);
});

test("valid image uploads persist and invalid uploads are rejected", async ({ request }) => {
  const valid = await request.post("/api/donate", {
    headers: { Authorization: `Bearer ${donorToken}` },
    multipart: {
      location,
      foodDetails: "Food with image",
      expiryHours: "2",
      image: { name: "meal.png", mimeType: "image/png", buffer: png }
    }
  });
  expect(valid.status()).toBe(201);
  const donationId = (await valid.json()).donationId;

  const donations = await api(request, receiverToken, "get", `/api/donations/${location}`);
  expect(donations.status()).toBe(200);
  const persisted = (await donations.json()).find(item => item._id === donationId);
  expect(persisted?.image).toMatch(/^[0-9a-f-]+\.png$/);

  const image = await request.get(`/uploads/${persisted.image}`);
  expect(image.status()).toBe(200);

  for (const upload of [
    { name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not png") },
    { name: "fake.png", mimeType: "application/octet-stream", buffer: png },
    { name: "large.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }
  ]) {
    const response = await request.post("/api/donate", {
      headers: { Authorization: `Bearer ${donorToken}` },
      multipart: {
        location,
        foodDetails: "Rejected upload",
        image: upload
      }
    });
    expect(response.status()).toBe(400);
  }
});

test("admin management and notification synchronization", async ({ request }) => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required.");
  }
  const login = await request.post("/api/admin/login", {
    data: { email: adminEmail, password: adminPassword }
  });
  expect(login.status()).toBe(200);
  const adminToken = (await login.json()).token;

  const users = await api(request, adminToken, "get", "/api/admin/users");
  expect(users.status()).toBe(200);
  expect((await users.json()).some(user => user.email === ngo.email)).toBe(true);

  const removable = {
    name: `Removable User ${suffix}`,
    email: `removable-${suffix}@example.test`,
    password
  };
  expect((await request.post("/api/register", { data: removable })).status()).toBe(200);
  const refreshedUsers = await api(request, adminToken, "get", "/api/admin/users");
  const removableRecord = (await refreshedUsers.json()).find(user => user.email === removable.email);
  expect(removableRecord?._id).toBeTruthy();
  const deleted = await api(
    request,
    adminToken,
    "delete",
    `/api/admin/delete-user/${removableRecord._id}`
  );
  expect(deleted.status()).toBe(200);

  const donations = await api(request, adminToken, "get", "/api/admin/donations");
  expect(donations.status()).toBe(200);
  expect((await donations.json()).some(donation => donation.donorEmail === donor.email)).toBe(true);

  const notifications = await api(
    request,
    donorToken,
    "get",
    `/api/notifications/donor/${location}`
  );
  expect(notifications.status()).toBe(200);
  expect((await notifications.json()).some(item =>
    item.requestId === requestId && item.requestState === "completed"
  )).toBe(true);
});

test("responsive layouts render without horizontal overflow", async ({ page }) => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
  }
});

test("logout revokes REST and Socket.IO access", async ({ request }) => {
  const token = await registerAndLogin(request, {
    name: `Logout User ${suffix}`,
    email: `logout-${suffix}@example.test`,
    password
  });
  const authorizedResponse = await api(
    request,
    token,
    "get",
    `/api/profile/logout-${suffix}@example.test`
  );
  expect(authorizedResponse.status()).toBe(200);

  const activeSocket = io(process.env.E2E_BASE_URL, {
    auth: { token },
    reconnection: false,
    timeout: 5000
  });
  try {
    await waitForSocketConnection(activeSocket);
    const disconnection = waitForServerDisconnect(activeSocket);

    try {
      const logout = await api(request, token, "post", "/api/logout", {});
      expect(logout.status()).toBe(200);
      await disconnection;
    } catch (error) {
      await disconnection.catch(() => {});
      throw error;
    }

    const protectedResponse = await api(
      request,
      token,
      "get",
      `/api/profile/logout-${suffix}@example.test`
    );
    expect(protectedResponse.status()).toBe(401);
    await expectUnauthorizedSocketRejection(token);
  } finally {
    activeSocket.removeAllListeners();
    activeSocket.close();
  }
});
