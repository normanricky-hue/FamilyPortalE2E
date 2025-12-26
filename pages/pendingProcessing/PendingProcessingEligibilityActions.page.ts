import { Page, Locator } from "@playwright/test";
import { waitForPendingProcessingData } from "../../utils/networkWaiter";

export class PendingProcessingEligibilityActionsPage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private normalizeEligibilityStatus(status: string): string {
  const map: Record<string, string> = {
    "Involuntary Disenrollment": "InVoluntary Disenrollment",
  };

  return map[status] ?? status;
}


  /* =========================================================
     FILTERS
     ========================================================= */

 async applyEligibilityStatusFilter(status: string): Promise<void> {
  await this.page.getByRole("button", { name: "Filter" }).click();
  await this.page.locator('button[name="eligibility_status"]').click();

  const normalizedStatus = this.normalizeEligibilityStatus(status);

  await this.page
    .getByRole("option", { name: normalizedStatus, exact: true })
    .click();

  await this.page.getByRole("button", { name: "Apply" }).click();
  await waitForPendingProcessingData(this.page);
  await this.page.waitForLoadState("networkidle");
}


  async clearEligibilityStatusFilter(): Promise<void> {
    // Open Filter
    await this.page.getByRole("button", { name: "Filter" }).click();

    // Open Eligibility dropdown
    await this.page.locator('button[name="eligibility_status"]').click();

    // Explicitly deselect all
    await this.page.getByRole("button", { name: "Deselect All" }).click();

    // Apply
    await this.page.getByRole("button", { name: "Apply" }).click();

    await this.page.waitForLoadState("networkidle");
  }

  /* =========================================================
     GRID HELPERS
     ========================================================= */

  async hasRecords(): Promise<boolean> {
    const noRecords = this.page.getByText("No Records Found!");
    if (await noRecords.isVisible().catch(() => false)) {
      return false;
    }

    return (await this.page.locator("tbody tr").count()) > 0;
  }

  private firstRow(): Locator {
    return this.page.locator("tbody tr").first();
  }

  /* =========================================================
     DATA EXTRACTION
     ========================================================= */

  /**
   * Reads "Latest Eligibility Status" from the first row.
   * This is the 2nd last column in the grid.
   */
  async getFirstRowLatestEligibilityStatus(): Promise<string> {
    const row = this.firstRow();

    const statusCell = row.locator("td").nth(-2);
    const status = (await statusCell.textContent())?.trim();

    if (!status) {
      throw new Error(
        "Failed to read Latest Eligibility Status from first grid row"
      );
    }

    return status;
  }

  /**
   * Opens ellipsis menu (Radix UI) for first row
   * and returns all available action labels.
   */
  async getFirstRowActions(): Promise<string[]> {
    await this.page.waitForSelector('tbody tr button[aria-haspopup="menu"]', {
      state: "attached",
      timeout: 10000,
    });

    const ellipsisButton = this.page
      .locator('tbody tr button[aria-haspopup="menu"]')
      .first();

    await ellipsisButton.scrollIntoViewIfNeeded();
    await ellipsisButton.dispatchEvent("pointerdown");

    const menu = this.page.locator('[role="menu"]');
    await menu.waitFor({ state: "attached", timeout: 5000 });

    const menuItems = menu.locator('[role="menuitem"]');
    const actions: string[] = [];

    for (let i = 0; i < (await menuItems.count()); i++) {
      const text = (await menuItems.nth(i).textContent())?.trim();
      if (text) actions.push(text);
    }

    console.log("🧩 Ellipsis actions found:", actions);

    await this.page.keyboard.press("Escape");
    return actions;
  }
}
