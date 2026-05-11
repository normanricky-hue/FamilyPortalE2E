import dotenv from 'dotenv';
dotenv.config();

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // Global test timeout — wall-clock limit for one complete user workflow.
  // Raised to 180 s: at 30 users / 6 shards / distributed GitHub runners,
  // retrying an entire 7-step healthcare portal workflow is more expensive
  // than allowing moderately longer first attempts to succeed.
  timeout: 180000,

  expect: {
    // Assertion timeout — 40 s tolerates backend rendering delays under high
    // concurrency without burning a retry on a transient slow response.
    timeout: 40000,
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

    // Action timeout — 90 s covers the slowest legitimate portal interactions
    // (JS-heavy state transitions, spinner waits) under distributed concurrency.
    // Stays well under the 180 s global ceiling so hung workers are still recovered.
    actionTimeout: 90000,

    // Navigation timeout — 45 s absorbs SSO redirect chains and slow initial
    // page loads under 6-shard parallel execution without causing false failures.
    navigationTimeout: 45000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
