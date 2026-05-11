import dotenv from 'dotenv';
dotenv.config();

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // Global test timeout — 480 s: diagnostic mode, no retries, so each attempt
  // receives maximum time to complete under distributed concurrency load.
  // We want TRUE failures, not artificially aggressive timeouts.
  timeout: 480000,

  expect: {
    // Assertion timeout — 120 s: tolerates backend rendering and contention
    // delays during 30-user parallel execution without creating false failures.
    timeout: 120000,
  },

  globalSetup: './utils/globalSetup.ts',

  testDir: "./tests",

  fullyParallel: true,
  // CI (GitHub Actions): lower workers to respect 2-vCPU runner limits
  // Local: higher concurrency for faster execution
  // DIAGNOSTIC MODE: retries disabled to expose true concurrency failures.
  // Re-enable (CI ? 1 : 0) after bottlenecks are identified and resolved.
  retries: 0,

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

    // Action timeout — 240 s: diagnostic mode covers the slowest JS-heavy
    // portal interactions and spinner waits under 30-user concurrent load.
    actionTimeout: 240000,

    // Navigation timeout — 120 s: absorbs SSO redirect chains and slow initial
    // page loads without masking true navigation failures.
    navigationTimeout: 120000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
