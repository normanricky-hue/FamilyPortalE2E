import dotenv from 'dotenv';
dotenv.config();

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  timeout: 200000, // 2 minutes per test

  expect: {
    timeout: 50000,
  },

  globalSetup: './utils/globalSetup.ts',

  testDir: "./tests",

  fullyParallel: true,
  // CI (GitHub Actions): lower workers to respect 2-vCPU runner limits
  // Local: higher concurrency for faster execution
  retries: process.env.CI ? 1 : 0,

  workers: process.env.CI ? 5 : 20,

  // CI: blob only (blob-report/ → merged later by merge-reports step)
  // Local: HTML report for immediate viewing + blob for future sharding readiness
  reporter: process.env.CI
    ? [['blob']]
    : [['html', { open: 'never' }], ['blob'], ['dot'], ['list']],

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
