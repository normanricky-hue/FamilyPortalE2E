import { Page, Locator, expect } from "@playwright/test";
import * as path from "path";
import { ENV_CONFIG } from "../config/env.config";

export class ImportPopupPage {
  readonly page: Page;
  readonly fileUploadInput: Locator;
  readonly proceedButton: Locator;
  readonly gotoPendingButton: Locator;

  readonly successMessage: Locator;
  readonly fileIdValue: Locator;
  readonly fileNameValue: Locator;
  readonly totalRecordsValue: Locator;
  readonly summaryByCategory: Locator;
  readonly summaryByEligibility: Locator;

  constructor(page: Page) {
    this.page = page;

    // File upload elements
    this.fileUploadInput = page.locator("#file-upload");
    this.proceedButton = page.getByRole("button", {
      name: "Proceed to Import",
    });
    this.gotoPendingButton = page.getByRole("button", {
      name: "Go to Pending Processing",
    });

    // Success message
    this.successMessage = page.locator("text=File Imported Successfully");

    // File details
    this.fileIdValue = page.getByRole("button", { name: /^\d+$/ }); // numeric File ID
    this.fileNameValue = page.locator("div > div:nth-child(2) > strong");
    this.totalRecordsValue = page.locator("div > div:nth-child(3) > strong");

    // Summary by Category
    const container = page
      .locator('h3:has-text("Summary by Category")')
      .locator("..");
    const grid = container.locator(":scope > div");
    this.summaryByCategory = grid.locator(":scope > div");

    // Summary by Eligibility Status
    const eligibilityContainer = page
      .locator('h3:has-text("Summary by Eligibility Status")')
      .locator("..");
    const eligibilityGrid = eligibilityContainer.locator(":scope > div");
    this.summaryByEligibility = eligibilityGrid.locator(":scope > div");
  }

  // async uploadImportFile(fileName: string = "EF15.csv") {
  //   const filePath = path.resolve(`C:/KanAutomate/excelData/${fileName}`);
  //   await this.fileUploadInput.setInputFiles(filePath);
  // }
  async uploadImportFile(fileName?: string) {
    const filePath = fileName
      ? path.join(ENV_CONFIG.csv.baseDir, fileName)
      : ENV_CONFIG.csv.fullPath;

    await this.fileUploadInput.setInputFiles(filePath);
  }

  async proceedToImport() {
    let isEnabled = false;
    let attempts = 0;
    while (!isEnabled && attempts < 60) {
      isEnabled = await this.proceedButton.isEnabled();
      if (!isEnabled) await this.page.waitForTimeout(500);
      attempts++;
    }
    await this.proceedButton.click();
  }

  async getImportSummary() {
    // await this.successMessage.waitFor({ state: "visible" });
    await expect(this.successMessage).toBeVisible();

    const fileId = (await this.fileIdValue.textContent())?.trim();
    const fileName = (await this.fileNameValue.textContent())?.trim();
    const totalRecords = (await this.totalRecordsValue.textContent())?.trim();

    const summaryCards = this.summaryByCategory;
    const categoryCount = await summaryCards.count();
    const categories: Record<string, string> = {};

    for (let i = 0; i < categoryCount; i++) {
      const card = summaryCards.nth(i);
      const title = (
        await card.locator("p:nth-child(1)").textContent()
      )?.trim();
      const value = (
        await card.locator("p:nth-child(2)").textContent()
      )?.trim();
      if (title && value) categories[title] = value;
    }

    return { fileId, fileName, totalRecords, categories };
  }

  async getEligibilitySummary() {
    const summaryCards = this.summaryByEligibility;
    const count = await summaryCards.count();
    const eligibility: Record<string, string> = {};

    for (let i = 0; i < count; i++) {
      const card = summaryCards.nth(i);
      const label = (
        await card.locator("p:nth-child(1)").textContent()
      )?.trim();
      const value = (
        await card.locator("p:nth-child(2)").textContent()
      )?.trim();
      if (label && value) eligibility[label] = value;
    }

    return eligibility;
  }

  async goToPendingProcessingAndWaitForParent(parent: Page) {
    await this.gotoPendingButton.click();
    await parent.waitForSelector('span:has-text("Client / Participant")', {
      timeout: 60000,
    });
  }
}
