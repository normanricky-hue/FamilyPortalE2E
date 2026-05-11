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
    // Assertion timeout — raised from 20 s back to 25 s after observing ~50% retry
    // rate under 6-shard / 30-user distributed runs. The portal's backend rendering
    // under high concurrency occasionally needs those extra 5 s to resolve; tighter
    // values produced false assertion failures that burned a full retry attempt.
    timeout: 25000,
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

    // Action timeout — raised from 40 s to 60 s after distributed retry analysis.
    // Under 6-shard parallel execution against a legacy healthcare portal, click and
    // fill interactions occasionally stall for 40–55 s due to JS-heavy page state.
    // 60 s prevents premature action failures while remaining well under the 130 s
    // global test timeout, so a genuinely hung worker is still recovered promptly.
    actionTimeout: 60000,

    // Navigation timeout — raised from 25 s to 30 s to absorb slower initial page
    // loads under high distributed concurrency (DNS + TLS + SSO redirect chain).
    // 30 s keeps navigations bounded without causing false timeout failures that
    // previously inflated the retry rate.
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
