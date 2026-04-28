// metrics-report.js
// Usage: node metrics-report.js
const fs = require('fs');
const path = require('path');


const resultsFile = path.join(__dirname, 'results', 'test_results.json');
const htmlReportFile = path.join(__dirname, 'results', 'report.html');


function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[idx];
}

function main() {
  if (!fs.existsSync(resultsFile)) {
    console.error('Results file not found:', resultsFile);
    process.exit(1);
  }
  const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
  const durations = results.map(r => r.duration);
  const passes = results.filter(r => r.status === 'Pass');
  const fails = results.filter(r => r.status === 'Fail');
  const timeouts = results.filter(r => r.errorMsg && r.errorMsg.toLowerCase().includes('timeout'));

  const total = results.length;
  const avg = durations.reduce((a, b) => a + b, 0) / (total || 1);
  const median = percentile(durations, 50);
  const p90 = percentile(durations, 90);
  const p95 = percentile(durations, 95);
  const p99 = percentile(durations, 99);
  const errorRate = (fails.length / (total || 1)) * 100;
  const timeoutCount = timeouts.length;
  const totalTime = durations.reduce((a, b) => a + b, 0) / 1000; // in seconds
  const workflowsPerMinute = totalTime ? (total / (totalTime / 60)) : 0;

  // Print to console (existing behavior)
  console.log('\n--- E2E Workflow Metrics ---');
  console.log(`Total Users:           ${total}`);
  console.log(`Average Duration:      ${(avg / 1000).toFixed(2)} s`);
  console.log(`Median Duration:       ${(median / 1000).toFixed(2)} s`);
  console.log(`90th Percentile (p90): ${(p90 / 1000).toFixed(2)} s`);
  console.log(`95th Percentile (p95): ${(p95 / 1000).toFixed(2)} s`);
  console.log(`99th Percentile (p99): ${(p99 / 1000).toFixed(2)} s`);
  console.log(`Error Rate:            ${errorRate.toFixed(2)} %`);
  console.log(`Timeout Count:         ${timeoutCount}`);
  console.log(`Workflows per Minute:  ${workflowsPerMinute.toFixed(2)}`);
  console.log('-----------------------------\n');

  // Updated workflow steps
  const workflowSteps = [
    'Log in to the Family Portal application.',
    'Go to the renewables page and do the actions.',
    'Go to the Review Pay Period page.',
    'Create planned visits for two employees.',
    'Perform the following actions on the visit plan:',
    '&nbsp;&nbsp;- Send for Correction',
    '&nbsp;&nbsp;- Approve Visit Plan',
    'Navigate to Employer Pay Stub (redirects to PASS page).',
    'Navigate to the Authorizations page.',
    'Navigate to the Reimbursement page.',
    'Navigate to the Denied Timesheet page.',
    'Navigate to the Vendor Timesheet page.',
    'Log out of the application.'
  ];

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>E2E Workflow Metrics Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2em; background: #f9f9f9; color: #222; }
    h1 { color: #2c3e50; }
    h2 { color: #1a73e8; }
    table { border-collapse: collapse; width: 70%; margin-bottom: 2em; background: #fff; }
    th, td { border: 1px solid #ccc; padding: 10px 16px; text-align: left; }
    th { background: #e3eafc; }
    ul { margin-bottom: 2em; }
    .explanation { background: #eaf6fb; border-left: 4px solid #1a73e8; padding: 1em; margin-bottom: 2em; }
  </style>
</head>
<body>
  <h1>E2E Workflow Metrics Report</h1>
  <div class="explanation">
    <strong>About this report:</strong><br>
    This report summarizes the results of the automated end-to-end (E2E) workflow for the Family Portal application. Below are the workflow steps performed, followed by a summary of test metrics and explanations to help you interpret the results.
  </div>
  <h2>Workflow Steps</h2>
  <ul>
    ${workflowSteps.map(step => `<li>${step}</li>`).join('')}
  </ul>
  <h2>Test Summary</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Total Users</td><td>${total}</td></tr>
    <tr><td>Average Duration</td><td>${(avg/1000).toFixed(2)} s</td></tr>
    <tr><td>Median Duration</td><td>${(median/1000).toFixed(2)} s</td></tr>
    <tr><td>90th Percentile (p90)</td><td>${(p90/1000).toFixed(2)} s</td></tr>
    <tr><td>95th Percentile (p95)</td><td>${(p95/1000).toFixed(2)} s</td></tr>
    <tr><td>99th Percentile (p99)</td><td>${(p99/1000).toFixed(2)} s</td></tr>
    <tr><td>Error Rate</td><td>${errorRate.toFixed(2)} %</td></tr>
    <tr><td>Timeout Count</td><td>${timeoutCount}</td></tr>
    <tr><td>Workflows per Minute</td><td>${workflowsPerMinute.toFixed(2)}</td></tr>
  </table>
  <div class="explanation">
    <strong>How to read these metrics:</strong><br>
    <ul>
      <li><b>Total Users:</b> Number of user workflows tested.</li>
      <li><b>Average/Median Duration:</b> Typical time taken for a workflow to complete.</li>
      <li><b>Percentiles (p90, p95, p99):</b> 90%, 95%, and 99% of workflows finished within this time.</li>
      <li><b>Error Rate:</b> Percentage of workflows that failed.</li>
      <li><b>Timeout Count:</b> Number of workflows that timed out.</li>
      <li><b>Workflows per Minute:</b> Throughput of the system (higher is better).</li>
    </ul>
    <p><b>Results interpretation:</b><br>
    A low error rate and timeout count indicate stable workflows. Lower average and percentile durations mean faster performance. If any metric is unusually high or low, further investigation may be needed.</p>
  </div>
</body>
</html>
`;
  fs.writeFileSync(htmlReportFile, html, 'utf-8');
  console.log(`HTML report generated at: ${htmlReportFile}`);
}

main();
