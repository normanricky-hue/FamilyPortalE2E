import { Page,expect } from "@playwright/test";
import { ImportPopupPage } from "./ImportPopupPage";
import { waitForPendingProcessingData } from "../utils/networkWaiter";

export class SummaryByCategoryPage {
  constructor(private page: Page) {}

  async clickFilterButton(): Promise<void> {
    const filterButton = this.page.getByRole("button", { name: "Filter" });
    await filterButton.waitFor({ state: "visible", timeout: 30000 });
    await filterButton.click();
    await this.page.waitForLoadState("networkidle");
  }

  async clickSearchTextbox(): Promise<void> {
    const textbox = this.page.getByRole("textbox", {
      name: /Search By File ID/,
    });
    await textbox.waitFor({ state: "visible", timeout: 30000 });
    await textbox.click();
  }

  async fillSearchTextbox(value: string): Promise<void> {
    const textbox = this.page.getByRole("textbox", {
      name: /Search By File ID/,
    });
    await textbox.waitFor({ state: "visible", timeout: 30000 });
    
    await textbox.fill(value);
  }

  async clickApplyButton(): Promise<void> {
    const applyButton = this.page.getByRole("button", { name: "Apply" });
    await applyButton.waitFor({ state: "visible", timeout: 30000 });
    await applyButton.click();
    // Wait for backend data readiness (robust)
    await waitForPendingProcessingData(this.page);
  }

  async searchByFileId(fileId: string): Promise<void> {
    await this.clickFilterButton();
    // await this.clickSearchTextbox();
    await this.fillSearchTextbox(fileId);
    await this.clickApplyButton();
    await this.page.waitForLoadState("networkidle");
    await this.page.waitForLoadState("domcontentloaded");
    const appliedFilters = this.page.locator(
  'div.flex.flex-row.gap-2.flex-wrap.py-2 > div'
);

await expect(appliedFilters.first()).toBeVisible();

  }

  async searchByImportedFileId(
    importPopupPage: ImportPopupPage
  ): Promise<void> {
    const importSummary = await importPopupPage.getImportSummary();
    const fileId = importSummary.fileId;

    if (!fileId) {
      throw new Error("File ID not found in import summary");
    }

    await this.searchByFileId(fileId);
  }
}

