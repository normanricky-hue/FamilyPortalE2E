import { Page } from '@playwright/test';
import { ENV_CONFIG } from "../config/env.config";

export class LoginPage {
  readonly page: Page;
  constructor(page: Page) {
    this.page = page;
  }

  // async goto() {
  //   await this.page.goto('https://working.kantimehealth.net/identity/v2/Accounts/Authorize');
  // }
  async goto() {
  await this.page.goto(
    `${ENV_CONFIG.baseUrl}${ENV_CONFIG.urls.login}`
  );
}

  private async fillFirstMatchingSelector(selectors: string[], value: string) {
    for (const sel of selectors) {
      const locator = this.page.locator(sel);
      try {
        if (await locator.count() > 0) {
          const visible = await locator.first().isVisible().catch(() => false);
          if (visible) {
            await locator.first().fill(value);
            return true;
          }
        }
      } catch (e) {
        // ignore and try next selector
      }
    }
    // fallback: try to type into the first input on the page
    try {
      const first = this.page.locator('input').first();
      if (await first.count()) {
        await first.fill(value);
        return true;
      }
    } catch (e) {
      // ignore
    }
    return false;
  }

  async fillUsername(username: string) {
    const usernameSelectors = [
      'input[name="UserName"]',
      'input[name="username"]',
      'input[type="email"]',
      'input[id*=user]',
      'input[placeholder*=Email]',
    ];
    await this.fillFirstMatchingSelector(usernameSelectors, username);
  }

  async fillPassword(password: string) {
    const passwordSelectors = [
      'input[name="Password"]',
      'input[name="password"]',
      'input[type="password"]',
      'input[id*=pass]',
      'input[placeholder*=Password]',
    ];
    await this.fillFirstMatchingSelector(passwordSelectors, password);
  }

  async fillCredentials(username: string, password: string) {
    await this.fillUsername(username);
    await this.fillPassword(password);
  }

  async clickLogin() {
    const selectors = [
      'button[type="submit"]',
      'button[id*=login]',
      'button:has-text("Log in")',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      'input[type="submit"]',
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
        // ignore and try next selector
      }
    }
    return false;
  }
}
