import { test, expect } from "@playwright/test";
import { ReferralPage } from "../pages/ReferralPages";
import { ImportPopupPage } from "../pages/ImportPopupPage";
import { PendingProcessingPage } from "../pages/PendingProcessingPage";
import { SummaryByCategoryPage } from "../pages/summarybycategory.page";
import {
  calculateEligibilitySummary,
  parseCsv,
  validateEligibilitySummary,
} from "../utils/csv-to-json";
import { ENV_CONFIG } from "../config/env.config";

test.describe("@smoke @importFile", () => {
  test("User should be able to import a file successfully", async ({
    page,
  }) => {
    page.setDefaultTimeout(20000);

    const csvFilePath = ENV_CONFIG.csv.fullPath;

    await page.goto(`${ENV_CONFIG.baseUrl}${ENV_CONFIG.urls.dashboard}`);

    const referral = new ReferralPage(page);

    // Open Import popup
    const { popup, parent } = await referral.openImportPopup();
    const importPopup = new ImportPopupPage(popup);

    // Upload file
    await importPopup.uploadImportFile();
    await importPopup.proceedToImport();

    // Get import summary
    const summary = await importPopup.getImportSummary();
    console.log("Import Summary:", JSON.stringify(summary, null, 2));

    // Get eligibility summary
    const eligibilitySummary = await importPopup.getEligibilitySummary();
    console.log(
      "Eligibility Summary:",
      JSON.stringify(eligibilitySummary, null, 2)
    );

    const records = parseCsv(csvFilePath);
    validateEligibilitySummary(eligibilitySummary, records, expect);

    // Navigate to Pending Processing
    await importPopup.goToPendingProcessingAndWaitForParent(parent);

    const pendingPage = new PendingProcessingPage(page);

    // Create SummaryByCategoryPage object to filter by file ID on each tab click
    const summaryByCategory = new SummaryByCategoryPage(page);
    // await pendingPage.clickEachTabAndValidate(summaryByCategory, summary.fileId!);
    await pendingPage.clickTabsFromSummary(
      summaryByCategory,
      summary.fileId!,
      summary.categories
    );
  });
});
