import dotenv from 'dotenv';
dotenv.config();

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  timeout: 200000, // ✅ 2 minutes per test

  expect: {
    timeout: 50000, // ✅ 10 seconds (fail fast)
  },

  testDir: "./tests",

  fullyParallel: true, // ✅ enable real parallelism
  retries: 0,

  workers: 15, // ✅ start safe, scale later

  reporter: [["html", { open: "never" }], ["dot"], ["list"]],

  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",

    headless: true, // ✅ important for parallel runs

    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    permissions: ["geolocation"],

    actionTimeout: 150000,
    navigationTimeout: 25000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
