import { Page, expect } from '@playwright/test';

export class EmployerPayStubPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForLoad() {
    await this.page.waitForLoadState();
  }

  async verifyLoaded() {
    await expect(
      this.page.getByText('Payroll Activity Report', { exact: true })
    ).toBeVisible();
  }

  async close() {
    await this.page.close();
  }
}