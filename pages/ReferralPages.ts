import { Page, Locator } from "@playwright/test";

export class ReferralPage {
  readonly page: Page;
  readonly referralTab: Locator;
  readonly eligibilityIrisBtn: Locator;
  readonly importNewFileBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.referralTab = page.getByText("Referral", { exact: true });
    this.eligibilityIrisBtn = page.getByText("Eligibility - IRIS", {
      exact: true,
    });
    this.importNewFileBtn = page.getByRole("cell", {
      name: "Import New File",
      exact: true,
    });
  }

  async openImportPopup() {
    // Navigate to Referral section
    await this.referralTab.click();

    // Click Eligibility - IRIS
    await this.eligibilityIrisBtn.waitFor({ state: "visible", timeout: 10000 });
    await this.eligibilityIrisBtn.click();

    // Wait for Import New File button and open popup
    await this.importNewFileBtn.waitFor({ state: "visible", timeout: 10000 });
    const popupPromise = this.page.waitForEvent("popup");
    await this.importNewFileBtn.click();
    const popup = await popupPromise;

    return {
      popup,
      parent: this.page, // Pass parent separately if needed
    };
  }
}
