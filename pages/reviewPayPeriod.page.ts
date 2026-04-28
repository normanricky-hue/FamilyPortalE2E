// pages/reviewPayPeriod.page.ts
import { Page, expect } from '@playwright/test';

export class ReviewPayPeriodPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async open() {
    await this.page.locator('#div_FamilyReviewPayPeriod').click();
    await this.page.waitForLoadState('networkidle');
  }

  async verifyLoaded() {
    await expect(
      this.page.getByText('Review Pay Periods', { exact: true })
    ).toBeVisible();
  }
}