// pages/vendorTimesheet.page.ts
import { Page, expect } from '@playwright/test';

export class VendorTimesheetPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async open() {
    await this.page.locator('#div_VendorTimesheets').click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async verifyLoaded() {
    const frame = this.page.frameLocator('#vendorTimesheetFrame');

    await expect(
      frame.getByText('Vendor Visits', { exact: true })
    ).toBeVisible();
  }
}