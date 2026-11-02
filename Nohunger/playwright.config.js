const { defineConfig } = require("@playwright/test");

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) {
  throw new Error("E2E_BASE_URL is required for Playwright tests.");
}

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure"
  },
  reporter: [["list"]]
});
