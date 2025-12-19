import { Page } from '@playwright/test';
import { ENV_CONFIG } from '../config/env.config';

export class ProductSelectionPage {
  readonly page: Page;
  constructor(page: Page) {
    this.page = page;
  }

  async waitForProductOptions() {
    // Wait for a typical product selection container
    await this.page.waitForSelector('text=Select a product', { timeout: 50000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  async selectHomeHealth() {
    // Try a variety of selectors to find the Home Health option
    const selectors = [
      'text=Home Health',
      'button:has-text("Home Health")',
      'a:has-text("Home Health")',
      '[role="option"]:has-text("Home Health")',
      'li:has-text("Home Health")',
    ];

    for (const sel of selectors) {
      const locator = this.page.locator(sel);
      try {
        if (await locator.count() > 0) {
          const first = locator.first();
          if (await first.isVisible().catch(() => false)) {
            await first.click();
            return true;
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return false;
  }

  async waitForRedirectToProduct() {
  const dashboardUrl = `${ENV_CONFIG.baseUrl}${ENV_CONFIG.urls.dashboard}`;

  await Promise.race([
    this.page.waitForURL(dashboardUrl, { timeout: 150000 }).catch(() => {}),
  ]);

  await this.page.waitForTimeout(10000);
}
}
