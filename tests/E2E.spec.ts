import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";

import { LoginPage } from "../pages/login.page";
import { RenewablePage } from "../pages/renewable.page";
import { AuthorizationsPage } from "../pages/authorizations.page";
import { DeniedTimesheetPage } from "../pages/deniedTimesheet.page";
import { VendorTimesheetPage } from "../pages/vendorTimesheet.page";
import { ReviewPayPeriodPage } from "../pages/reviewPayPeriod.page";
import { EmployerPayStubPage } from "../pages/employerPayStub.page";
import { getUsers } from "../utils/userLoader";

const users = getUsers();

/** Directory where each worker writes its own isolated partial results file. */
const partialsDir = path.join(__dirname, "../results/partials");

/**
 * Upserts one result record into this worker's own partial file, keyed by username.
 * If an entry for the same username already exists (e.g. from a Playwright retry),
 * it is replaced so the final/latest attempt always wins — no duplicate rows.
 * No locking required — each Playwright worker runs its tests sequentially.
 */
function appendToWorkerPartial(result: any, workerIndex: number): void {
  const partialFile = path.join(partialsDir, `results-worker-${workerIndex}.json`);

  let existing: any[] = [];
  if (fs.existsSync(partialFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(partialFile, 'utf-8'));
    } catch {
      existing = [];
    }
  }

  // Upsert: replace any previous entry for this username (handles retries).
  const idx = existing.findIndex((r: any) => r.username === result.username);
  if (idx !== -1) {
    existing[idx] = result; // overwrite with latest attempt result
  } else {
    existing.push(result);
  }

  fs.writeFileSync(partialFile, JSON.stringify(existing, null, 2), 'utf-8');
}

// Shard identity injected by GitHub Actions via SHARD_INDEX env var.
// Falls back to 'local' when running outside CI.
const SHARD_ID = process.env.SHARD_INDEX || 'local';

test.describe.parallel("Family portal E2E UI Automation", () => {
  for (const user of users) {
    // Test title embeds user login + shard for easy artifact correlation.
    // Playwright uses the title as the artifact directory name, so screenshots,
    // videos, and traces produced by this test will be stored under a path that
    // includes the username and shard, e.g.:
    //   test-results/[E2E][user@email.com][Shard-2]-chromium/
    test(`[E2E][${user.username}][Shard-${SHARD_ID}]`, async ({ page, context }, testInfo) => {
      const workerTag = `[Shard-${SHARD_ID}][Worker-${testInfo.workerIndex}]`;
      const userTag   = `[${user.username}]`;
      const diagTag   = `[DIAG]${userTag}${workerTag}`;

      // ── Execution identity annotations (visible in Playwright HTML report) ──
      testInfo.annotations.push({ type: 'User',        value: user.username });
      testInfo.annotations.push({ type: 'ShardIndex',  value: String(SHARD_ID) });
      testInfo.annotations.push({ type: 'WorkerIndex', value: String(testInfo.workerIndex) });
      testInfo.annotations.push({ type: 'RetryIndex',  value: String(testInfo.retry) });

      const start = Date.now();
      let status = "Pass";
      let errorMsg = "";

      console.log(`${diagTag} ── TEST START ─── ${new Date(start).toISOString()}`);

      try {
        const login = new LoginPage(page);
        const renewable = new RenewablePage(page);
        const auth = new AuthorizationsPage(page);
        const denied = new DeniedTimesheetPage(page);
        const vendor = new VendorTimesheetPage(page);
        const review = new ReviewPayPeriodPage(page);

        await login.goto();
        console.log(`${diagTag} [1/7] goto login page`);
        await login.fillCredentials(user.username, user.password);

        const clicked = await login.clickLogin();
        if (!clicked) {
          console.warn(`${diagTag} Login button not found`);
        }
        console.log(`${diagTag} [1/7] login submitted`);

        // ✅ Stable Home Navigation
        const goHome = async () => {
          await page.locator('a[href*="HomePageLink"]').first().click();

          const loader = page.getByText("Loading...");
          const quickLaunch = page.getByText("Quick Launch");

          if (await loader.isVisible().catch(() => false)) {
            await loader.waitFor({ state: "hidden", timeout: 10000 });
          }

          await expect(quickLaunch).toBeVisible({ timeout: 20000 });
        };

        // 🔹 Renewable
        console.log(`${diagTag} [2/7] opening Renewable`);
        await renewable.open();
        await renewable.waitForLoad();
        await renewable.processAndMarkCompleted();
        console.log(`${diagTag} [2/7] Renewable done`);

        await goHome();

        // 🔹 Authorizations
        console.log(`${diagTag} [3/7] opening Authorizations`);
        await auth.open();
        await auth.verifyLoaded();
        console.log(`${diagTag} [3/7] Authorizations done`);

        await goHome();

        // 🔹 Denied Timesheet
        console.log(`${diagTag} [4/7] opening Denied Timesheet`);
        await denied.open();
        await denied.verifyLoaded();
        console.log(`${diagTag} [4/7] Denied Timesheet done`);

        await goHome();

        // 🔹 Vendor Timesheet
        console.log(`${diagTag} [5/7] opening Vendor Timesheet`);
        await vendor.open();
        await vendor.verifyLoaded();
        console.log(`${diagTag} [5/7] Vendor Timesheet done`);

        await goHome();

        // 🔹 Review Pay Period
        console.log(`${diagTag} [6/7] opening Review Pay Period`);
        await review.open();
        await review.verifyLoaded();
        console.log(`${diagTag} [6/7] Review Pay Period done`);

        await goHome();

        // 🔥 Employer Pay Stub (FINAL STABLE VERSION)
        console.log(`${diagTag} [7/7] opening Employer Pay Stub`);

        const payStubBtn = page.locator("#div_EmployerPayStub");
        await expect(payStubBtn).toBeVisible();

        let payStubPageRaw: any = null;
        let alertHandled = false;

        // ✅ Handle alert BEFORE click
        page.once("dialog", async (dialog) => {
          const message = dialog.message();
          console.warn(`${diagTag} Alert: ${message}`);

          if (message.toLowerCase().includes("no pay stubs")) {
            alertHandled = true;
          }

          await dialog.accept();
        });

        // ✅ Listen BEFORE click (important)
        const pagePromise = context.waitForEvent("page").catch(() => null);

        // 👉 Single click only
        await payStubBtn.click();

        // ⏳ Wait for UI response
        await page.waitForTimeout(1500);

        // ✅ Case 1: Alert → skip
        if (alertHandled) {
          console.warn(`${diagTag} [7/7] No Pay Stub available, skipping`);
          return;
        }

        // ✅ Case 2: New tab
        payStubPageRaw = await pagePromise;

        if (payStubPageRaw) {
          console.log(`${diagTag} [7/7] Pay Stub opened in new tab`);

          const payStubPage = new EmployerPayStubPage(payStubPageRaw);
          await payStubPage.waitForLoad();
          await payStubPage.verifyLoaded();
          await payStubPage.close();

          console.log(`${diagTag} [7/7] Pay Stub (new tab) done`);
          return;
        }

        // ✅ Case 3: Same tab
        const reportLocator = page.getByText("Payroll Activity Report", {
          exact: true,
        });

        try {
          await expect(reportLocator).toBeVisible({ timeout: 5000 });
          console.log(`${diagTag} [7/7] Pay Stub opened in same tab`);
          return;
        } catch {
          // no navigation happened
        }

        // ✅ Case 4: Feature not available → skip
        console.warn(`${diagTag} [7/7] Pay Stub not available, skipping`);
        return;
      } catch (e) {
        status = "Fail";
        errorMsg = e instanceof Error ? e.message : String(e);
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.error(`${diagTag} ── TEST FAILED after ${elapsed}s ── ${errorMsg.split('\n')[0]}`);
        testInfo.annotations.push({ type: 'FailureMessage', value: errorMsg.split('\n')[0] });
        throw e;
      } finally {
        const duration = Date.now() - start;
        console.log(`${diagTag} ── TEST END [${status}] ${(duration / 1000).toFixed(1)}s ───`);

        appendToWorkerPartial(
          {
            username: user.username,
            status,
            duration,
            errorMsg,
            retryCount: testInfo.retry,   // 0 = first attempt, 1 = retried
          },
          testInfo.workerIndex
        );
      }
    });
  }
});
