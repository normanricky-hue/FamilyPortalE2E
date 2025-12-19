# KanAutomate — Playwright E2E Automation

A lean Playwright test suite that validates the “Eligibility Import” workflow in Kantime Health. It logs in, imports a CSV, verifies UI summaries match the CSV contents, checks Pending Processing grids by category, and emails a rich HTML report with artifacts on failures.

## Who This Is For
- Product/QA: Understand coverage, run tests locally/CI, read reports.
- Engineers: Extend tests via page objects and helper utilities.
- Managers/Stakeholders: See at a glance what’s validated and how to view results.

## What It Covers
- Auth and session save to reuse between runs.
- Referral → “Eligibility - IRIS” → “Import New File” popup.
- Upload of `excelData/Eligibility_20240423.csv` and “Proceed to Import”.
- Import Summary capture: `fileId`, `fileName`, `totalRecords`, and Summary by Category.
- Eligibility Status validation: UI counts vs counts derived from CSV.
- Pending Processing: filters each category tab by the imported `fileId` and confirms grid totals.
- Reporting: HTML report locally; email summary with screenshots/videos on failure.

## Repository Structure
```
.
├─ pages/                          # Page Objects (POM)
│  ├─ login.page.ts                # Login flow + helpers
│  ├─ product-selection.page.ts    # Select “Home Health” (optional)
│  ├─ ReferralPages.ts             # Navigate to Referral → IRIS → Import
│  ├─ ImportPopupPage.ts           # Upload, import, collect summaries
│  ├─ PendingProcessingPage.ts     # Verify tabs + totals per category
│  └─ summarybycategory.page.ts    # Grid filter/search by File ID
├─ tests/
│  ├─ login.spec.ts                # Creates/refreshes auth storage state
│  └─ importFile.spec.ts           # Main import + validation scenario
├─ utils/
│  ├─ csv-to-json.ts               # CSV parsing + UI-vs-CSV assertions
│  ├─ emailSender.ts               # Nodemailer Gmail mailer
│  └─ testEmail.ts                 # Quick SMTP credential check
├─ reporters/
│  └─ emailReporter.ts             # Custom Playwright reporter with HTML email
├─ excelData/
│  └─ Eligibility_20240423.csv     # Sample input file (anonymize in real use)
├─ storage/
│  └─ clinicianAuth.json           # Saved session (created by login test)
├─ playwright.config.ts            # Playwright runner configuration
├─ package.json                    # Dependencies
└─ README.md                       # You are here
```

## Prerequisites
- Node.js 18+ and npm
- A Kantime Health test/staging account
- Gmail credentials (for sending report emails) or adjust mail transport

## Install
```powershell
npm ci
npx playwright install
```

## Configure Email (Optional but recommended)
Create a `.env` file in the project root:
```dotenv
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password   # Use a Gmail App Password (2FA required)
EMAIL_RECEIVER=recipient@yourorg.com
```
Notes:
- Gmail generally requires an App Password (enable 2FA, then generate one).
- If you prefer another SMTP provider, update `utils/emailSender.ts` accordingly.

## Test Data
- Default CSV path: `C:\KanAutomate\excelData\Eligibility_20240423.csv`.
- The test reads the CSV and expects UI “Eligibility Status” counts to match the file’s `Status` column totals.

## Running The Tests
1) Create/refresh the authenticated storage state (recommended):
```powershell
npx playwright test tests/login.spec.ts --project=chromium
```
This writes `storage/clinicianAuth.json` used by all tests (configured in `playwright.config.ts`).

2) Run the main import scenario:
```powershell
npx playwright test tests/importFile.spec.ts --project=chromium
```

3) View the HTML report:
```powershell
npx playwright show-report
```

## What To Expect During A Run
- The login test navigates to Kantime identity, fills credentials, tries to select “Home Health,” and saves session to `storage/clinicianAuth.json`.
- The import test navigates to HH Dashboard, opens Referral → IRIS, imports the CSV, captures summaries, and validates:
  - Each Eligibility Status count equals the CSV-derived count.
  - Pending Processing tabs (mapped from Import Summary categories) show totals matching Import Summary after filtering by `fileId`.
- On completion, an HTML report is generated. If configured, an email is sent with a rich summary and failure artifacts.

## Configuration Highlights (`playwright.config.ts`)
- `testDir: './tests'` and single worker execution.
- `storageState: 'storage/clinicianAuth.json'` for authenticated runs.
- `reporter: [ 'html', './reporters/emailReporter', 'dot', 'list' ]`.
- Traces, screenshots, and videos retained on first retry/failure.

## Technology
- Playwright Test + TypeScript
- Page Object Model for maintainable selectors and flows
- Nodemailer for rich HTML email reporting
- CSV parsing via `csv-parse` (sync API)

## Extending The Suite
- Add a new test in `tests/` and reuse POM classes in `pages/`.
- Update tab/category mappings in `PendingProcessingPage.mapCategoryToTabLabel` if UI labels evolve.
- Add more CSV validations in `utils/csv-to-json.ts` (e.g., totals by category, date ranges).
- Point to different CSV files by editing the path in `tests/importFile.spec.ts` or by parameterizing it.

## Troubleshooting
- Auth expired or sign-in challenged:
  - Rerun `login.spec.ts` to refresh `storage/clinicianAuth.json`.
  - If CAPTCHA or multi-factor appears, you may need to complete it manually and resave storage.
- Email not sending:
  - Run `ts-node utils/testEmail.ts` or `node`-compiled equivalent to verify SMTP.
  - Ensure `.env` is present and App Password is valid.
- Selectors changed / elements not found:
  - Update relevant page object in `pages/`. The suite already uses resilient locators where possible.
- CSV mismatches on Eligibility Status:
  - Confirm CSV `Status` values match UI labels. Adjust mappings if the product uses different display names.

## Security & Privacy
- Do not commit real PII or production secrets.
- `.env` should be git-ignored (keep secrets local/secure).
- Treat `storage/clinicianAuth.json` as sensitive; it may include access tokens/cookies.
- Use anonymized or synthetic CSVs for demos.

## CI/CD
- You can wire this into any CI (GitHub Actions, Azure DevOps, etc.).
- Ensure environment variables are injected securely, and that a valid `storageState` is available or `login.spec.ts` can run headlessly with your identity provider.

---
Have questions or want a quick npm script to chain login → import → report? Open an issue or ask in your team channel.
