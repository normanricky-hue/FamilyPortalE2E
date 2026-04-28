// pages/deniedTimesheet.page.ts
import { Page, expect } from '@playwright/test';

export class DeniedTimesheetPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async open() {
    await this.page.locator('#div_DeniedTimesheet').click();
  }

  async verifyLoaded() {
    const frame = this.page.frameLocator('iframe');
    await expect(
      frame.getByText('Denied Timesheet', { exact: true })
    ).toBeVisible();
  }
}