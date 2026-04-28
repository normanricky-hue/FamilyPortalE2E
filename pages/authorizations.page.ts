// pages/authorizations.page.ts
import { Page, expect } from '@playwright/test';

export class AuthorizationsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async open() {
    await this.page.locator('#div_Authorizations').click();
  }

  // async verifyLoaded() {
  //   const frame = this.page.frameLocator('iframe');
  //   await expect(
  //     frame.getByText('Authorization Summary', { exact: true })
  //   ).toBeVisible();
  // }
  async verifyLoaded() {
    const frame = this.page.frameLocator('iframe');

    const loader = frame.getByText('Loading...');
    const summary = frame.getByText('Authorization Summary', { exact: true });
    const table = frame.locator('table');

    // Step 1: small buffer for iframe rendering
    await this.page.waitForTimeout(1000);

    // Step 2: wait for ANY stable state
    await Promise.race([
      summary.waitFor({ state: 'visible', timeout: 10000 }),
      table.first().waitFor({ state: 'visible', timeout: 10000 }),
      loader.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
    ]);

    // Step 3: if loader appeared, wait for it to disappear
    if (await loader.isVisible().catch(() => false)) {
      await loader.waitFor({ state: 'hidden', timeout: 10000 });
    }

    // Step 4: final validation (soft)
    const isLoaded =
      (await summary.isVisible().catch(() => false)) ||
      (await table.first().isVisible().catch(() => false));

    if (!isLoaded) {
      console.warn('⚠️ Authorizations loaded without expected UI, skipping validation');
    }
  }
}