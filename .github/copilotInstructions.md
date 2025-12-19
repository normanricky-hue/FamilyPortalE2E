#copilot instructions

Write automated tests in playwright following these guidelines:

-Follow playwright best practices
- Do not add comments to each line of code
- Write only the playwright test steps for the scenario
- Read and analyze the provided DOM content from the browser
- Create one test at a time unless specifically asked for multiple tests
- Prioitize `getByRole()` `getBYText()` selectors over `locator()` when possible
- Keep test code clean and focused on the test scenario
- Don't add assertion unless asked
- For the random test data, kep it short and compact. Don't write long texts.