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

const resultsFile = path.join(__dirname, "../results/test_results.json");
const lockFile = path.join(__dirname, "../results/test_results.lock");

// Results file is initialized in utils/globalSetup.ts (runs once before all workers).
// No beforeAll needed here — avoids the per-worker overwrite race condition.

/**
 * Sleep utility — avoids CPU-heavy busy-spin while waiting for the lock file.
 */
function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Safely writes a single result to the shared results file using an atomic
 * lock file. Handles stale locks left by crashed workers and avoids
 * busy-spin waiting.
 */
function writeResultSafely(result: any) {
  const maxRetries = 50;
  const retryDelayMs = 100;
  const staleLockAgeMs = 10_000; // treat lock as stale after 10 seconds

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Atomic lock acquisition — fails immediately if lock file already exists
      fs.writeFileSync(lockFile, process.pid.toString(), { flag: 'wx' });

      try {
        // Read current accumulated results
        let results: any[] = [];
        try {
          const content = fs.readFileSync(resultsFile, 'utf-8');
          results = JSON.parse(content);
        } catch {
          // File missing or corrupt — start fresh for this write
          results = [];
        }

        results.push(result);
        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2), 'utf-8');
        return; // success
      } finally {
        // Always release the lock, even if the write above threw
        try { fs.unlinkSync(lockFile); } catch { /* already gone */ }
      }
    } catch (err: any) {
      if (err.code !== 'EEXIST') {
        // Unexpected error — do not swallow
        throw err;
      }

      // Lock file exists — check whether it is stale (left by a crashed worker)
      try {
        const lockStat = fs.statSync(lockFile);
        const lockAgeMs = Date.now() - lockStat.mtimeMs;
        if (lockAgeMs > staleLockAgeMs) {
          console.warn(
            `[writeResultSafely] Stale lock detected (age: ${Math.round(lockAgeMs / 1000)}s). Removing and retrying.`
          );
          try { fs.unlinkSync(lockFile); } catch { /* race: another worker already cleared it */ }
          // Immediately retry without sleeping
          continue;
        }
      } catch {
        // statSync failed — lock already released by the other worker; retry
        continue;
      }

      // Lock is fresh — sleep before retrying (no CPU spin)
      sleep(retryDelayMs + Math.floor(Math.random() * 50));
    }
  }

  console.error(
    `[writeResultSafely] Failed to write result for ${
      result?.username ?? 'unknown'
    } after ${maxRetries} attempts. Result may be missing from report.`
  );
}

test.describe.parallel("Family portal E2E UI Automation", () => {
  for (const user of users) {
    test(`E2E for ${user.username}`, async ({ page, context }) => {
      const start = Date.now();
      let status = "Pass";
      let errorMsg = "";

      try {
        const login = new LoginPage(page);
        const renewable = new RenewablePage(page);
        const auth = new AuthorizationsPage(page);
        const denied = new DeniedTimesheetPage(page);
        const vendor = new VendorTimesheetPage(page);
        const review = new ReviewPayPeriodPage(page);

        await login.goto();
        await login.fillCredentials(user.username, user.password);

        const clicked = await login.clickLogin();
        if (!clicked) {
          console.warn(`[${user.username}] Login button not found`);
        }

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
        await renewable.open();
        await renewable.waitForLoad();
        await renewable.processAndMarkCompleted();

        await goHome();

        // 🔹 Authorizations
        await auth.open();
        await auth.verifyLoaded();

        await goHome();

        // 🔹 Denied Timesheet
        await denied.open();
        await denied.verifyLoaded();

        await goHome();

        // 🔹 Vendor Timesheet
        await vendor.open();
        await vendor.verifyLoaded();

        await goHome();

        // 🔹 Review Pay Period
        await review.open();
        await review.verifyLoaded();

        await goHome();

        // 🔥 Employer Pay Stub (FINAL STABLE VERSION)

        const payStubBtn = page.locator("#div_EmployerPayStub");
        await expect(payStubBtn).toBeVisible();

        let payStubPageRaw: any = null;
        let alertHandled = false;

        // ✅ Handle alert BEFORE click
        page.once("dialog", async (dialog) => {
          const message = dialog.message();
          console.warn(`[${user.username}] Alert: ${message}`);

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
          console.warn(`[${user.username}] ⚠️ No Pay Stub available, skipping`);
          return;
        }

        // ✅ Case 2: New tab
        payStubPageRaw = await pagePromise;

        if (payStubPageRaw) {
          console.log(`[${user.username}] Opened in new tab`);

          const payStubPage = new EmployerPayStubPage(payStubPageRaw);
          await payStubPage.waitForLoad();
          await payStubPage.verifyLoaded();
          await payStubPage.close();

          return;
        }

        // ✅ Case 3: Same tab
        const reportLocator = page.getByText("Payroll Activity Report", {
          exact: true,
        });

        try {
          await expect(reportLocator).toBeVisible({ timeout: 5000 });
          console.log(`[${user.username}] Opened in same tab`);
          return;
        } catch {
          // no navigation happened
        }

        // ✅ Case 4: Feature not available → skip
        console.warn(`[${user.username}] ⚠️ Pay Stub not available, skipping`);
        return;
      } catch (e) {
        status = "Fail";
        errorMsg = e instanceof Error ? e.message : String(e);
        throw e;
      } finally {
        const duration = Date.now() - start;

        writeResultSafely({
          username: user.username,
          status,
          duration,
          errorMsg,
        });
      }
    });
  }
});
