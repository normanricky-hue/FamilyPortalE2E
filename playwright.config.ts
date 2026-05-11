import dotenv from 'dotenv';
dotenv.config();

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // Global test timeout — wall-clock limit for one complete user workflow
  // (login → 7 portal steps → pay stub).
  // 200 s was too generous: a genuinely stuck worker would hold a shard slot
  // for ~3 min before Playwright could recover it.
  // 130 s gives the full multi-step workflow enough headroom while ensuring
  // stuck tests fail fast and free their worker for the next user.
  timeout: 130000,

  expect: {
    // Assertion timeout — how long expect(...).toBeVisible() etc. will poll.
    // 50 s caused assertion hangs to inflate p95/p99 significantly under
    // distributed concurrency. 20 s is sufficient for healthcare portal
    // page transitions while still tolerating slow network renders.
    timeout: 20000,
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

    // Action timeout — per-action limit for clicks, fills, selects, etc.
    // 150 s was effectively unlimited: a single stalled .click() could starve
    // a worker for the entire global test timeout. 40 s matches the longest
    // legitimate portal interaction (e.g. waiting for a spinner to clear after
    // a button click) while allowing the global timeout to act as the outer
    // safety net if multiple actions are slow.
    actionTimeout: 40000,

    // Navigation timeout — limit for page.goto() and navigation events.
    // 25 s is appropriate for the healthcare portal under distributed load
    // and is kept unchanged. If DNS/TLS is involved, this gives sufficient
    // margin while preventing indefinite hangs on unreachable pages.
    navigationTimeout: 25000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
