# Family Portal E2E

This repository tests the **Family Portal web application** from the perspective
of a signed-in user. It is a Node.js/TypeScript [Playwright](https://playwright.dev/)
test suite, **not** the portal application itself: there is no server to start
here. You need access to a separate, reachable portal environment and test
accounts with the appropriate permissions.

One Playwright test is created per account in `data/users.json`. Each test logs
in, visits Renewables, Authorizations, Denied Timesheet, Vendor Timesheet,
Review Pay Period, and Employer Pay Stub. The Renewables step can **mark
eligible items as completed and save changes**. Use only accounts and an
environment where these changes are safe. Do not point this suite at production
without explicit authorization.

## Quick start (Windows PowerShell)

1. Install Node.js 20 (the version used in CI) and npm, then check:

   ```powershell
   node --version
   npm --version
   ```

2. From the repository root, install the locked dependencies and the Chromium
   browser used by the tests:

   ```powershell
   npm ci
   npx playwright install chromium
   ```

   On Linux, Playwright may also require OS packages; see
   [Playwright browser installation](https://playwright.dev/docs/browsers#install-system-dependencies).
   CI installs them using `npx playwright install --with-deps chromium`.

3. Create a `.env` file in the repository root containing the portal's base
   URL **without a trailing slash** (the login page code appends a path starting
   with `/`):

   ```dotenv
   BASE_URL=https://your-authorized-staging-host.example
   ```

   `.env.example` shows the available variable names, but do not assume its
   example credentials are valid or safe to use. `APP_USERNAME` and
   `APP_PASSWORD` are **not used** by the tests; accounts come from
   `data/users.json` instead.

4. Replace the empty `data/users.json` with a JSON array of approved test
   accounts. For a first run, use just one account:

   ```json
   [
     {
       "username": "test-user@example.com",
       "password": "your-test-password"
     }
   ]
   ```

   The checked-in `data/users.example.json` is an empty array and is not
   sufficient to run tests. Obtain the URL and test credentials from the
   project owner; do not use real user credentials.

5. Run the suite with limited concurrency while learning the environment:

   ```powershell
   npx playwright test tests/E2E.spec.ts --workers=2
   npx playwright show-report
   ```

   A successful run requires a reachable portal, valid accounts, and the
   expected portal data/UI. Start with one account before increasing the
   worker count. By default the config requests 20 local workers, runs tests
   in parallel, records traces and video, and allows up to 8 minutes per test;
   a full run can be resource-intensive.

   On macOS/Linux the commands are the same; create `.env` and
   `data/users.json` with your preferred editor.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm test -- --workers=2` | Run all Playwright tests with two workers. |
| `npx playwright test tests/E2E.spec.ts --grep "test-user@example.com" --workers=1` | Run only the named account's test (use its actual username). |
| `npx playwright test --headed --workers=1` | Watch Chromium run interactively. |
| `npx playwright show-report` | Open the local Playwright HTML report after a run. |
| `npx playwright show-trace path/to/trace.zip` | Inspect an individual Playwright trace from `test-results/`. |
| `node merge-metrics.js` | Combine worker results into `results/test_results.json` after a test run. |
| `node metrics-report.js` | Build `results/report.html` from the merged results. |
| `node generate-pdf.js` | Build `results/report.pdf` from the metrics HTML (needs Chromium). |

`npm run test:login`, `npm run test:smoke`, and `npm run test:smoke-seq`
currently filter for `@login`/`@smoke` tags, but the existing test has neither
tag. These scripts are not useful until tagged tests are added.

**Do not use `npm run e2e:all` as a first-run command.** It runs the tests,
merges reports, creates HTML/PDF/ZIP files, and attempts to send an email via
Gmail SMTP. It tries every step even if an earlier step fails. To use it,
configure `EMAIL_USER`, `EMAIL_PASS` (a suitable Gmail app password), and
optionally `EMAIL_TO` in `.env`, and confirm that sending mail is intended.
The script prints a summary but does not currently reliably fail the process
when one of its steps fails.

## How the code fits together

| Path | Responsibility |
| --- | --- |
| `playwright.config.ts` | Chromium project, timeouts, workers, reporters, artifacts, global setup. |
| `config/env.config.ts` | Loads `.env`, requires `BASE_URL`, defines the login path. |
| `data/users.json` / `utils/userLoader.ts` | Test account list and its loader; a nonempty JSON array is required. |
| `tests/E2E.spec.ts` | One end-to-end test per user; orchestrates the seven steps and records duration/status. |
| `pages/*.page.ts` | Page objects containing selectors and portal-specific interactions. |
| `utils/globalSetup.ts` | Resets `results/partials/` and `results/test_results.json` before each Playwright run. |
| `merge-metrics.js` / `metrics-report.js` | Combine per-worker results and render summary HTML. |
| `generate-pdf.js` / `zip-report.js` | Create a PDF summary and ZIP of the Playwright report. |
| `send-report.js` / `run-all.js` | Send the report by email / run the full local pipeline. |
| `.github/workflows/playwright.yml` | Manually triggered, sharded CI run and artifact/report aggregation. |

Flow: `users.json` -> Playwright tests -> per-worker
`results/partials/*.json` and Playwright `blob-report/`/`test-results/` ->
`merge-metrics.js` -> `results/test_results.json` ->
`metrics-report.js` -> `results/report.html` -> `generate-pdf.js` ->
`results/report.pdf`. Playwright also writes `playwright-report/` locally.
For a local metrics report, run the merge and HTML/PDF commands **after**
Playwright finishes; running another test first resets the partials.

The HTML report shows pass/fail, durations, retries, and timeout counts.
`test-results/` contains screenshots on failure and traces/video for all tests.
These artifacts and log messages can contain usernames and sensitive portal
data: restrict access and avoid attaching them to public issues.

## CI (GitHub Actions)

The **Playwright E2E Tests** workflow is started manually using
`workflow_dispatch`. It accepts a shard count (default 3; clamped to 1-10)
and a workers field used for **report metadata**, not to configure Playwright.
Each shard installs dependencies/Chromium, creates its account file from a
secret, runs its slice of the suite, and uploads diagnostic and result
artifacts. The merge job downloads the artifacts, builds the final reports,
and sends one email. Inspect the Actions run and its artifacts for failures;
the shard jobs use `continue-on-error`.

Configure repository Actions secrets before starting CI:

| Secret | Meaning |
| --- | --- |
| `BASE_URL` | Authorized portal environment, without trailing slash. |
| `USERS_JSON` | JSON array of `{ "username": "...", "password": "..." }` objects. |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail SMTP account and app password for the final report. |
| `EMAIL_TO` | Optional recipient; defaults to `EMAIL_USER`. |

CI runs on Node.js 20. Only supply approved, isolated accounts: sharded tests
run concurrently and the Renewables action changes portal state.

## Contributing

1. Get authorization for a safe test environment and test accounts. Work on a
   branch; keep credentials, portal data, reports, and recordings out of
   commits and public issue attachments.
2. Put orchestration/assertions in `tests/` and reusable portal interactions
   in the appropriate `pages/` page object. Prefer stable role/text selectors
   or a specific iframe selector; wait for a meaningful UI state rather than
   introducing arbitrary sleeps.
3. Add or update assertions for the behavior you change. If a test performs a
   write, document what it changes and make it safe to rerun. Avoid masking
   unexpected states as successful skips.
4. Run the affected account/test with `--workers=1`, inspect
   `playwright-report/` and traces on failure, then run the wider suite in an
   authorized environment. No separate unit-test, lint, or typecheck scripts
   are currently configured.
5. In your pull request, explain the scenario, expected portal behavior,
   test environment (not credentials), verification command/results, and any
   data cleanup needed.

## Troubleshooting and known limitations

- `BASE_URL is not set`: put `BASE_URL=...` in `.env` at the repository root
  (or set it in the environment). The login URL is built by concatenation, so
  omit the trailing `/`.
- `users.json is empty or not an array`: add at least one account to
  `data/users.json`; `.env` account variables do not populate it.
- Browser executable missing: rerun `npx playwright install chromium`.
- Unexpected 0-user metrics: run the tests first, then `node merge-metrics.js`;
  global setup clears old partials each run. An empty metrics file is not proof
  that tests passed.
- The test can pass even when Authorizations lacks the expected UI or Pay Stub
  is unavailable (those branches warn/skip). Review the console and traces,
  not only the pass count.
- The generated metrics report's documented workflow steps include
  reimbursement and logout, but the current test does **not** perform them.
  Verify the test itself when assessing coverage.
- `data/users.json` and `results/` are ignored for new files but may already
  be tracked in this repository. Check `git status`/`git diff` before committing
  to avoid publishing credentials or portal data.
