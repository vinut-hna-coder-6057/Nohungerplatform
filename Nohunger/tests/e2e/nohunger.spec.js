const { test, expect } = require("@playwright/test");

test.describe.configure({ mode: "serial" });

const suffix = `${Date.now()}-${process.pid}`;
const donor = {
  name: `E2E Donor ${suffix}`,
  email: `e2e-donor-${suffix}@example.test`,
  password: "E2eTestPassword123!"
};
const receiver = {
  name: `E2E Receiver ${suffix}`,
  email: `e2e-receiver-${suffix}@example.test`,
  password: "E2eTestPassword123!"
};
const location = `e2e-${suffix}`;
let donorToken;
let receiverToken;
let requestId;

async function registerAndLogin(request, user) {
  const register = await request.post("/api/register", { data: user });
  expect(register.status()).toBe(200);
  const login = await request.post("/api/login", {
    data: { email: user.email, password: user.password }
  });
  expect(login.status()).toBe(200);
  return (await login.json()).token;
}

async function api(request, token, method, path, data) {
  const response = await request[method](path, {
    headers: { Authorization: `Bearer ${token}` },
    data
  });
  return response;
}

test("the application loads and rejects unauthenticated protected access", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("No Hunger Chatbot");
  const response = await page.request.get("/api/profile/not-authenticated@example.test");
  expect(response.status()).toBe(401);
});

test("donor and receiver accounts complete the donation lifecycle", async ({ page, request }) => {
  donorToken = await registerAndLogin(request, donor);
  receiverToken = await registerAndLogin(request, receiver);

  expect((await api(request, donorToken, "post", "/api/registerRole", {
    role: "donor",
    location
  })).status()).toBe(200);
  expect((await api(request, receiverToken, "post", "/api/registerRole", {
    role: "receiver",
    location
  })).status()).toBe(200);

  const created = await api(request, donorToken, "post", "/api/notify", {
    details: { q1: "Rice", q2: "4 meals" },
    foodType: "veg"
  });
  expect(created.status()).toBe(200);
  requestId = (await created.json()).requestId;

  const discovered = await api(
    request,
    receiverToken,
    "get",
    `/api/notifications/receiver/${location}`
  );
  expect(discovered.status()).toBe(200);
  expect((await discovered.json()).some(item => item.requestId === requestId)).toBe(true);

  expect((await api(request, receiverToken, "post", "/api/update-status", {
    requestId,
    status: "receiver_accepted"
  })).status()).toBe(200);
  expect((await api(request, donorToken, "post", "/api/update-status", {
    requestId,
    status: "self_collect"
  })).status()).toBe(403);

  expect((await api(request, receiverToken, "post", "/api/update-status", {
    requestId,
    status: "self_collect"
  })).status()).toBe(200);
  expect((await api(request, donorToken, "post", "/api/update-status", {
    requestId,
    status: "reached"
  })).status()).toBe(200);
  expect((await api(request, receiverToken, "post", "/api/update-status", {
    requestId,
    status: "received"
  })).status()).toBe(200);

  const activity = await api(request, receiverToken, "get", `/api/my-activity/${receiver.email}`);
  expect(activity.status()).toBe(200);
  expect((await activity.json()).some(item => item.requestId === requestId && item.requestState === "completed")).toBe(true);

  await page.goto("/");
  await page.evaluate(({ token, email }) => {
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("userEmail", email);
  }, { token: receiverToken, email: receiver.email });
  await page.reload();
  await expect(page.locator("body")).toContainText("No Hunger");
});

test("admin dashboard requires configured admin credentials", async ({ page, request }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required for the admin E2E test.");
  }
  const response = await request.post("/api/admin/login", { data: { email, password } });
  expect(response.status()).toBe(200);
  await page.goto("/");
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.locator("#loginEmail").fill(email);
  await page.locator("#loginPassword").fill(password);
  page.once("dialog", dialog => dialog.accept());
  await page.locator("#loginPage button").first().click();
  await expect(page.locator("#adminPage")).toHaveClass(/active/);
});
