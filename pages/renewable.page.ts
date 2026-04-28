import { Page, expect, FrameLocator } from "@playwright/test";

export class RenewablePage {
  readonly page: Page;
  readonly frame: FrameLocator;

  constructor(page: Page) {
    this.page = page;
    this.frame = page.frameLocator('iframe[title="Renewable Item"]');
  }

  async open() {
    await this.page.locator("#div_Renewableitems").click();
  }

  // ✅ FINAL: Stable iframe + async content handling (TS-safe)
  async waitForLoad() {
    const body = this.frame.locator("body");

    // Step 1: Wait until iframe body has ANY content
    await this.page.waitForFunction(() => {
      const frame = document.querySelector(
        'iframe[title="Renewable Item"]'
      ) as HTMLIFrameElement | null;

      if (!frame) return false;

      const doc = frame.contentDocument;
      if (!doc || !doc.body) return false;

      return doc.body.innerText.trim().length > 0;
    }, { timeout: 10000 });

    // Step 2: Wait for ANY valid UI state
    await this.page.waitForFunction(() => {
      const frame = document.querySelector(
        'iframe[title="Renewable Item"]'
      ) as HTMLIFrameElement | null;

      if (!frame) return false;

      const text = frame.contentDocument?.body?.innerText || "";

      return (
        text.includes("Renewable List Items") ||
        text.includes("No Records Found!") ||
        text.includes("Please select a client")
      );
    }, { timeout: 10000 });

    // Step 3: Final visibility check (Playwright-level)
    await expect(body).toBeVisible();
  }

  async waitForFinalState(): Promise<"has-data" | "no-data" | "no-client"> {
    const noClientMsg = this.frame.getByText("Please select a client");
    const noRecordsMsg = this.frame.getByText("No Records Found!");
    const tableRows = this.frame.locator("table").nth(1).locator("tbody tr");

    // Allow UI to stabilize (client auto-selection etc.)
    await this.page.waitForTimeout(1500);

    // Final evaluation
    if (await tableRows.first().isVisible().catch(() => false)) {
      return "has-data";
    }

    if (await noRecordsMsg.isVisible().catch(() => false)) {
      console.log("⏭ Skipping: No records found");
      return "no-data";
    }

    if (await noClientMsg.isVisible().catch(() => false)) {
      console.log("⏭ Skipping: No client selected");
      return "no-client";
    }

    return "no-data";
  }

  async processAndMarkCompleted() {
    const state = await this.waitForFinalState();

    // 🚫 Skip safely
    if (state !== "has-data") return;

    const table = this.frame.locator("table").nth(1);
    const rowsLocator = table.locator("tbody tr");

    await expect(rowsLocator.first()).toBeVisible({ timeout: 15000 });

    const rowCount = await rowsLocator.count();
    console.log("Row count:", rowCount);

    for (let i = 0; i < rowCount; i++) {
      const row = table.locator("tbody tr").nth(i);

      const cells = row.locator("td");
      const cellCount = await cells.count();

      if (cellCount < 6) continue;

      const workflowCell = cells.nth(5);

      await expect(workflowCell).toBeAttached({ timeout: 5000 });

      const workflowStatus = (await workflowCell.textContent())?.trim();

      if (
        workflowStatus === "Pending Client Action" ||
        workflowStatus === "Returned for Correction"
      ) {
        await row.locator("button").last().click();

        await this.frame
          .getByRole("menuitem", { name: "Mark as Completed" })
          .click();

        await this.frame
          .getByRole("textbox")
          .fill("Completed as requested.");

        await Promise.all([
          this.page.waitForResponse(
            (res) =>
              res.url().includes("/complete") && res.status() === 200
          ),
          this.frame.getByRole("button", { name: "Save" }).click(),
        ]);

        await this.page.waitForLoadState("networkidle");
      }
    }
  }
}