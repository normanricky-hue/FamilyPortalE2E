import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { ProductSelectionPage } from '../pages/product-selection.page';
import fs from 'fs';
import path from 'path';
import { ENV_CONFIG } from "../config/env.config";

const STORAGE_PATH = path.join(__dirname, '..', 'playwright-storage.json');
test.describe(' @login',()=>
{
  test(' login, select Home Health and save storage state', async ({ page, context }) => {
  const login = new LoginPage(page);
  const product = new ProductSelectionPage(page);

  await login.goto();

  // await login.fillCredentials('1test@1245.com', 'Demo@123');
  await login.fillCredentials(
  ENV_CONFIG.credentials.username,
  ENV_CONFIG.credentials.password
);

  // Click login
  const clicked = await login.clickLogin();
  if (!clicked) {
    // if we couldn't find a login button just proceed to save storage (fail early in CI)
    console.warn('Login button not found; continuing without clicking');
  }

  // Product selection not required for this login; commented out.
  await product.waitForProductOptions();
  const selected = await product.selectHomeHealth();
  if (!selected) {
    console.warn('Home Health option not found; continuing');
  }
  
  await product.waitForRedirectToProduct();

  await page.context().storageState({ path: 'storage/clinicianAuth.json' });

  console.log('✅ Clinician session saved!');
});


});


