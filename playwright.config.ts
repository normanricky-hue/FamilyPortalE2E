import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  timeout: 30 * 5000, 
  expect: {
    timeout: 60000, 
  },
  testDir: "./tests",
  fullyParallel: false,
  //retries: process.env.CI ? 2 : 0,
  retries: 0,
  //workers: process.env.CI ? 1 : undefined,
  workers: 1,
  reporter: [
    ["html",{ open: "on-failure" }],
    // ['allure-playwright'],
    ["./reporters/emailReporter"],
    ["dot"],
    ["list"],
  ],
  use: {
    storageState: "storage/clinicianAuth.json",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: false,
    viewport: { width: 1280, height: 720 }, // Set default viewport size for consistency
    ignoreHTTPSErrors: true, // Ignore SSL errors if necessary
    permissions: ["geolocation"], // Set necessary permissions for geolocation-based tests
      actionTimeout: 15000, // clicks, fills
    navigationTimeout: 60000, // waits for navigation like goto(), reload()
  },
  
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    
  ],
});
