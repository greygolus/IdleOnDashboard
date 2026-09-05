const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  workers: 2,
  use: { baseURL: "http://127.0.0.1:4173", viewport: { width: 1366, height: 900 }, trace: "retain-on-failure" },
  webServer: { command: "node server.js", url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI },
  reporter: "list"
});
