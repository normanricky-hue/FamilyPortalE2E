
// run-all.js
// Usage: node run-all.js
const { execSync } = require('child_process');


function runStep(description, command) {
  console.log(`\n--- ${description} ---`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`--- ${description} completed ---`);
    return true;
  } catch (err) {
    // If the error has a status property and it's 0, treat as success
    if (err.status === 0) {
      console.log(`--- ${description} completed (with exit code 0) ---`);
      return true;
    }
    console.error(`Error during: ${description}`);
    if (err.status !== undefined) {
      console.error(`Exit code: ${err.status}`);
    }
    if (err.stdout) {
      console.error(`STDOUT: ${err.stdout.toString()}`);
    }
    if (err.stderr) {
      console.error(`STDERR: ${err.stderr.toString()}`);
    }
    console.error(err.message);
    return false;
  }
}



// Always attempt all steps, regardless of previous step success
let testSuccess = runStep('Running Playwright E2E tests', 'npx playwright test tests/E2E.spec.ts');
let reportSuccess = runStep('Generating metrics HTML report', 'node metrics-report.js');
let pdfSuccess = runStep('Generating metrics PDF report', 'node generate-pdf.js');
let zipSuccess = runStep('Zipping Playwright HTML report', 'node zip-report.js');
let mailSuccess = runStep('Sending report via email', 'node send-report.js');

console.log('\nSummary:');
console.log(`E2E Tests: ${testSuccess ? 'SUCCESS' : 'FAILED'}`);
console.log(`Report Generation: ${reportSuccess ? 'SUCCESS' : 'FAILED'}`);
console.log(`PDF Generation: ${pdfSuccess ? 'SUCCESS' : 'FAILED'}`);
console.log(`Zipping Report: ${zipSuccess ? 'SUCCESS' : 'FAILED'}`);
console.log(`Email Sending: ${mailSuccess ? 'SUCCESS' : 'FAILED'}`);
console.log('All steps attempted. Check above for any errors.');
