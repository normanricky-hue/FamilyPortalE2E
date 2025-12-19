import { Page } from "@playwright/test";
import { SummaryByCategoryPage } from "./summarybycategory.page";
import { waitForPendingProcessingData } from "../utils/networkWaiter";

export class PendingProcessingPage {
  constructor(private page: Page) {}

  // Map summary categories to HTML tab labels
  private mapCategoryToTabLabel(category: string): string | null {
    const mapping: Record<string, string> = {
      "Intake Updates": "Intake Update(s)",
      "Client Updates": "Client Update(s)",
      "New Participants": "New Participant(s)",
      "Re-Admits": "Re-Admit(s)",
      "Non-Admit Updates": "Non-Admit Update(s)",
      "Conflict Records": "Conflict Record(s)",
      // "Duplicates" has no tab → returns null
    };
    return mapping[category] || null;
  }

  async clickTabsFromSummary(
    summaryByCategory: SummaryByCategoryPage,
    fileId: string,
    categories: Record<string, string>
  ) {
    const DEFAULT_CATEGORY = "New Participants";

    // ✅ Step 1: Validate default tab (already active on page load)
    if (categories[DEFAULT_CATEGORY]) {
      console.log(
        `👉 Default tab '${DEFAULT_CATEGORY}' is active. Validating without clicking.`
      );

      await summaryByCategory.searchByFileId(fileId);

      const totalRecords = await this.getTotalRecordsFromGrid();
      const expectedCount = parseInt(categories[DEFAULT_CATEGORY], 10);

      if (totalRecords === expectedCount) {
        console.log(
          `✅ Total records validated for '${DEFAULT_CATEGORY}': ${totalRecords}`
        );
      } else {
        console.error(
          `❌ Total records mismatch for '${DEFAULT_CATEGORY}': Expected ${expectedCount}, Found ${totalRecords}`
        );
      }
    }

    // ✅ Step 2: Iterate remaining categories
    for (const [categoryKey, expectedCountStr] of Object.entries(categories)) {
      // ⏭ Skip default tab (already validated)
      if (categoryKey === DEFAULT_CATEGORY) {
        console.log(`⏭ Skipping click for default tab: ${DEFAULT_CATEGORY}`);
        continue;
      }

      const tabLabel = this.mapCategoryToTabLabel(categoryKey);
      if (!tabLabel) {
        console.log(
          `⚠️ No tab mapping for category: ${categoryKey} → Skipping`
        );
        continue;
      }

      const tab = this.page.locator(
        `button[role="tab"]:has-text("${tabLabel}")`
      );

      const isVisible = await tab.isVisible().catch(() => false);
      if (!isVisible) {
        console.log(
          `⚠️ Tab not visible for category: ${categoryKey} → Skipping`
        );
        continue;
      }

      console.log(`👉 Clicking tab: ${tabLabel}`);
      await tab.scrollIntoViewIfNeeded();
      await tab.click();

      // ✅ Backend WILL fire only when tab actually changes
      await this.page.waitForResponse(
        (res) =>
          res.url().includes("pending-processing-records") &&
          res.status() === 200
      );

      await this.page.waitForLoadState("networkidle");

      // Apply File ID filter
      await summaryByCategory.searchByFileId(fileId);
      console.log(`✅ Filter applied successfully on tab: ${tabLabel}`);

      // Validate total records
      const totalRecords = await this.getTotalRecordsFromGrid();
      const expectedCount = parseInt(expectedCountStr, 10);

      if (totalRecords === expectedCount) {
        console.log(
          `✅ Total records validated for '${categoryKey}': ${totalRecords}`
        );
      } else {
        console.error(
          `❌ Total records mismatch for '${categoryKey}': Expected ${expectedCount}, Found ${totalRecords}`
        );
      }
    }
  }

  async getTotalRecordsFromGrid(): Promise<number> {
    // Using getByText regex instead of class selector
    const totalRecordsLocator = this.page.getByText(
      /Showing\s+\d+\s*-\s*\d+\s+of\s+[\d,]+/
    );
    const text = (await totalRecordsLocator.textContent())?.trim() || "";

    const match = text.match(/of\s([\d,]+)/i);
    if (!match) {
      console.warn(
        `⚠️ Could not extract total records from grid text: ${text}`
      );
      return 0;
    }

    return parseInt(match[1].replace(/,/g, ""), 10);
  }
}
