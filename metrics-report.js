// metrics-report.js
// Usage: node metrics-report.js
const fs = require('fs');
const path = require('path');
require('dotenv').config();


const resultsFile = path.join(__dirname, 'results', 'test_results.json');
const htmlReportFile = path.join(__dirname, 'results', 'report.html');


/** Mask username for privacy: user@domain.com → u***@domain.com */
function maskUsername(username) {
  if (!username || typeof username !== 'string') return 'unknown';
  const atIdx = username.indexOf('@');
  if (atIdx <= 0) return username[0] + '***';
  const local = username.slice(0, atIdx);
  const domain = username.slice(atIdx); // includes @
  return local[0] + '***' + domain;
}

/**
 * Classify timeout type from error message for better observability.
 * Returns a short label or empty string if not a timeout.
 */
function classifyTimeout(errorMsg) {
  if (!errorMsg) return '';
  const msg = errorMsg.toLowerCase();
  if (!msg.includes('timeout')) return '';
  if (msg.includes('test timeout')) return 'Global';
  if (msg.includes('navigation') || msg.includes('waitfornavigation') || msg.includes('waitforurl')) return 'Navigation';
  if (msg.includes('locator') || msg.includes('waitfor') || msg.includes('tobevisible') || msg.includes('tohavetext')) return 'Locator';
  if (msg.includes('expect')) return 'Assertion';
  if (msg.includes('action')) return 'Action';
  return 'Timeout';
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  
  // Using linear interpolation method for accurate percentile calculation
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  // If index is an integer, return that value
  if (lower === upper) {
    return sorted[lower];
  }
  
  // Otherwise, interpolate between lower and upper values
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
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

  // Retry-aware classifications
  const cleanPasses  = passes.filter(r => !r.retryCount);       // passed first time
  const flakyPasses  = passes.filter(r => r.retryCount > 0);    // passed only after retry
  const hardFails    = fails.filter(r => r.retryCount > 0);     // failed all attempts
  const firstFails   = fails.filter(r => !r.retryCount);        // failed without retry (retries disabled or first attempt not retried)
  const retriedTotal = results.filter(r => r.retryCount > 0).length; // any record that went to retry

  const total = results.length;
  const avg = durations.reduce((a, b) => a + b, 0) / (total || 1);
  const median = percentile(durations, 50);
  const p90 = percentile(durations, 90);
  const p95 = percentile(durations, 95);
  const p99 = percentile(durations, 99);
  const errorRate = (fails.length / (total || 1)) * 100;
  const timeoutCount = timeouts.length;
  
  // Calculate throughput metrics
  const totalTime = durations.reduce((a, b) => a + b, 0) / 1000; // cumulative seconds
  const maxDuration = Math.max(...durations) / 1000; // longest test in seconds (approximation of wall-clock time for parallel execution)
  
  // Two throughput metrics:
  // 1. Cumulative capacity (if run sequentially)
  const cumulativeWorkflowsPerMinute = totalTime ? (total / (totalTime / 60)) : 0;
  // 2. Actual throughput (parallel execution approximation)
  const actualWorkflowsPerMinute = maxDuration ? (total / (maxDuration / 60)) : 0;

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
  console.log(`Actual Throughput:     ${actualWorkflowsPerMinute.toFixed(2)} workflows/min`);
  console.log(`Pass Rate:             ${((passes.length / (total || 1)) * 100).toFixed(2)} %`);
  console.log('-----------------------------\n');

  // Updated workflow steps
  const workflowSteps = [
    'Log in to the Family Portal application.',
    'Go to the renewables page and do the actions.',
    'Go to the Review Pay Period page.',
    'Navigate to Employer Pay Stub (redirects to PASS page).',
    'Navigate to the Authorizations page.',
    'Navigate to the Reimbursement page.',
    'Navigate to the Denied Timesheet page.',
    'Navigate to the Vendor Timesheet page.',
    'Log out of the application.'
  ];

  // Run metadata from CI environment variables
  const runId        = process.env.GITHUB_RUN_ID || '';
  const serverUrl    = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const repository   = process.env.GITHUB_REPOSITORY || '';
  const commitSha    = process.env.GITHUB_SHA || '';
  const shardCount   = process.env.SHARD_COUNT || process.env.TOTAL_SHARDS || '';
  const workerCount  = process.env.WORKERS || '';
  const reportTs     = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const runUrl       = runId && repository ? `${serverUrl}/${repository}/actions/runs/${runId}` : '';
  const shortSha     = commitSha ? commitSha.slice(0, 7) : '';

  // Generate per-user details table rows
  const userDetailsRows = results.map((result, index) => {
    const login       = maskUsername(result.username);
    const durationS   = (result.duration / 1000).toFixed(3);
    const isFail      = result.status === 'Fail';
    const isFlaky     = !isFail && result.retryCount > 0;
    const retry       = result.retryCount != null ? result.retryCount : '–';
    const timeoutType = classifyTimeout(result.errorMsg);
    const hasError    = isFail ? 1 : 0;
    const hasTimeout  = timeoutType ? 1 : 0;

    let statusBadge;
    if (isFail)       statusBadge = `<span class="badge badge-fail">Fail</span>`;
    else if (isFlaky) statusBadge = `<span class="badge badge-flaky">Pass*</span>`;
    else              statusBadge = `<span class="badge badge-pass">Pass</span>`;

    const rowClass = isFail ? 'row-fail' : isFlaky ? 'row-flaky' : (index % 2 === 0 ? 'row-even' : 'row-odd');
    const timeoutCell = timeoutType ? `<span class="timeout-label">${timeoutType}</span>` : '0';

    return `<tr class="${rowClass}">
      <td class="col-login" title="${result.username || ''}">${login}</td>
      <td class="col-status">${statusBadge}</td>
      <td class="col-duration">${durationS}</td>
      <td class="col-retry">${retry}</td>
      <td class="col-error">${hasError}</td>
      <td class="col-timeout">${timeoutCell}</td>
    </tr>`;
  }).join('');

  // Build run metadata HTML block
  const metaRows = [
    ['Report Generated', reportTs],
    runUrl       ? ['GitHub Run', `<a href="${runUrl}" target="_blank">${runUrl}</a>`] : null,
    shortSha     ? ['Commit', shortSha] : null,
    shardCount   ? ['Shards', shardCount] : null,
    workerCount  ? ['Workers per Shard', workerCount] : null,
  ].filter(Boolean).map(([k, v]) => `<tr><td><b>${k}</b></td><td>${v}</td></tr>`).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>E2E Workflow Metrics Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2em; background: #f4f6fa; color: #222; }
    h1 { color: #2c3e50; margin-bottom: 0.2em; }
    h2 { color: #1a73e8; margin-top: 1.5em; }
    table { border-collapse: collapse; width: 70%; margin-bottom: 2em; background: #fff;
            box-shadow: 0 1px 4px rgba(0,0,0,0.07); border-radius: 6px; overflow: hidden; }
    th, td { border: 1px solid #dde3f0; padding: 9px 15px; text-align: left; font-size: 0.95em; }
    th { background: #e3eafc; font-weight: 600; }
    /* Summary table alternating */
    table tr:nth-child(even) td { background: #f7f9ff; }
    /* Detail table */
    .detail-table { width: 98%; }
    .detail-table th { text-align: center; background: #2c3e50; color: #fff; }
    .detail-table td { text-align: center; }
    .row-fail   { background: #fff0f0; }
    .row-flaky  { background: #fffbea; }
    .row-odd    { background: #fff; }
    .row-even   { background: #f7f9ff; }
    /* Status badges */
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px;
             font-size: 0.82em; font-weight: 700; letter-spacing: 0.03em; }
    .badge-pass  { background: #d4edda; color: #155724; }
    .badge-fail  { background: #f8d7da; color: #721c24; }
    .badge-flaky { background: #fff3cd; color: #856404; }
    /* Timeout type label */
    .timeout-label { display: inline-block; padding: 1px 7px; border-radius: 8px;
                     font-size: 0.78em; background: #fde8c8; color: #7a4000; font-weight: 600; }
    /* Column widths */
    .col-login    { text-align: left !important; min-width: 150px; }
    .col-status   { min-width: 70px; }
    .col-duration { min-width: 90px; }
    .col-retry    { min-width: 55px; }
    .col-error    { min-width: 60px; }
    .col-timeout  { min-width: 90px; }
    /* Metadata / explanation boxes */
    .meta-box { background: #eef2fb; border: 1px solid #c5d0f0; border-radius: 6px;
                padding: 0.8em 1.2em; margin-bottom: 1.5em; font-size: 0.9em; }
    .meta-box table { width: auto; box-shadow: none; margin-bottom: 0; background: transparent; }
    .meta-box td { border: none; padding: 3px 12px 3px 0; background: transparent; }
    .explanation { background: #eaf6fb; border-left: 4px solid #1a73e8;
                   padding: 1em; margin-bottom: 2em; border-radius: 0 6px 6px 0; }
    .legend { font-size: 0.85em; margin-bottom: 0.5em; }
    .legend span { margin-right: 1em; }
    ul { margin-bottom: 2em; }
    a { color: #1a73e8; }
  </style>
</head>
<body>
  <h1>E2E Workflow Metrics Report</h1>

  <!-- Run Metadata -->
  <div class="meta-box">
    <b>Run Information</b>
    <table>${metaRows || '<tr><td>Local run — no CI metadata available</td></tr>'}</table>
  </div>

  <div class="explanation">
    <strong>About this report:</strong><br>
    Summarizes automated end-to-end (E2E) workflow results for the Family Portal application.
    Each row represents one unique user's <em>final</em> execution result.
    Durations reflect wall-clock time of the final attempt only.
    <b>Pass*</b> = passed after a Playwright retry (flaky). <b>Retry</b> column shows attempt index (0 = first try, 1 = retried).
  </div>

  <h2>Workflow Steps</h2>
  <ul>
    ${workflowSteps.map(step => `<li>${step}</li>`).join('')}
  </ul>

  <h2>Test Summary</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Total Users</td><td>${total}</td></tr>
    <tr><td>Passed (Clean)</td><td>${cleanPasses.length}</td></tr>
    <tr><td>Passed (Flaky — needed retry)</td><td>${flakyPasses.length}</td></tr>
    <tr><td>Failed</td><td>${fails.length}</td></tr>
    <tr><td>Total Retried</td><td>${retriedTotal}</td></tr>
    <tr><td>Average Duration</td><td>${(avg/1000).toFixed(2)} s</td></tr>
    <tr><td>Median Duration (p50)</td><td>${(median/1000).toFixed(2)} s</td></tr>
    <tr><td>90th Percentile (p90)</td><td>${(p90/1000).toFixed(2)} s</td></tr>
    <tr><td>95th Percentile (p95)</td><td>${(p95/1000).toFixed(2)} s</td></tr>
    <tr><td>99th Percentile (p99)</td><td>${(p99/1000).toFixed(2)} s</td></tr>
    <tr><td>Pass Rate</td><td>${((passes.length / (total || 1)) * 100).toFixed(2)} %</td></tr>
    <tr><td>Error Rate</td><td>${errorRate.toFixed(2)} %</td></tr>
    <tr><td>Timeout Count</td><td>${timeoutCount}</td></tr>
    <tr><td>Actual Throughput</td><td>${actualWorkflowsPerMinute.toFixed(2)} workflows/min</td></tr>
  </table>

  <h2>Detailed User Results</h2>
  <div class="legend">
    <span><span class="badge badge-pass">Pass</span> Clean pass</span>
    <span><span class="badge badge-flaky">Pass*</span> Passed after retry (flaky)</span>
    <span><span class="badge badge-fail">Fail</span> Failed final attempt</span>
    <span><span class="timeout-label">Locator</span> Timeout type</span>
  </div>
  <table class="detail-table">
    <tr>
      <th>Login</th>
      <th>Status</th>
      <th>Duration (s)</th>
      <th>Retry</th>
      <th>Errors</th>
      <th>Timeouts</th>
    </tr>
    ${userDetailsRows}
  </table>

  <div class="explanation">
    <strong>How to read these metrics:</strong>
    <ul>
      <li><b>Login:</b> Masked username (u***@domain.com) — hover for full address in tooltip.</li>
      <li><b>Status:</b> Final attempt result. Pass* = passed only after a retry (flaky test).</li>
      <li><b>Duration (s):</b> Wall-clock seconds for this user's final attempt — not an average.</li>
      <li><b>Retry:</b> 0 = passed/failed on first attempt; 1 = Playwright triggered a retry.</li>
      <li><b>Errors:</b> 1 if the final attempt threw an unhandled exception or assertion failure.</li>
      <li><b>Timeouts:</b> Type of timeout that caused failure (Locator / Navigation / Assertion / Global / Action), or 0 if none.</li>
      <li><b>Pass Rate:</b> Percentage of users whose workflow ultimately succeeded (including flaky passes).</li>
      <li><b>Actual Throughput:</b> Approximation of parallel workflows/min (total users ÷ longest single test duration).</li>
      <li><b>p90/p95/p99:</b> SLA indicators — 90%/95%/99% of user workflows completed within this time.</li>
    </ul>
    <p><b>Flaky tests</b> (Pass* / Retry=1) indicate intermittent instability and should be investigated even though they ultimately passed.</p>
  </div>
</body>
</html>
`;
  fs.writeFileSync(htmlReportFile, html, 'utf-8');
  console.log(`HTML report generated at: ${htmlReportFile}`);
}

main();
