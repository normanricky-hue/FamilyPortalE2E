// metrics-report.js â€” Phase-9: Observability dashboard report
// Usage: node metrics-report.js
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const resultsFile   = path.join(__dirname, 'results', 'test_results.json');
const htmlReportFile = path.join(__dirname, 'results', 'report.html');

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Mask username for privacy + PDF readability: john.doe@gmail.com â†’ jo***@gmail.com */
function maskUsername(username) {
  if (!username || typeof username !== 'string') return 'unknown';
  const atIdx = username.indexOf('@');
  if (atIdx <= 0) return username.slice(0, 2) + '***';
  const local  = username.slice(0, atIdx);
  const domain = username.slice(atIdx); // includes @
  const keep   = Math.min(2, local.length);
  return local.slice(0, keep) + '***' + domain;
}

/**
 * Classify timeout type from error message.
 * Returns a short label or '' if not a timeout failure.
 */
function classifyTimeout(errorMsg) {
  if (!errorMsg) return '';
  const msg = errorMsg.toLowerCase();
  if (!msg.includes('timeout')) return '';
  if (msg.includes('test timeout'))                                                      return 'Global';
  if (msg.includes('navigation') || msg.includes('waitfornavigation') || msg.includes('waitforurl')) return 'Navigation';
  if (msg.includes('locator') || msg.includes('waitfor') || msg.includes('tobevisible') || msg.includes('tohavetext')) return 'Locator';
  if (msg.includes('expect'))                                                            return 'Assertion';
  if (msg.includes('action'))                                                            return 'Action';
  return 'Timeout';
}

/** Classify non-timeout failures */
function classifyError(result) {
  if (result.status !== 'Fail') return null;
  const t = classifyTimeout(result.errorMsg);
  if (t) return t + ' Timeout';
  if (!result.errorMsg || result.errorMsg.trim() === '') return 'Unknown Error';
  return 'Assertion / Script Error';
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index  = (p / 100) * (sorted.length - 1);
  const lower  = Math.floor(index);
  const upper  = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - (index - lower)) + sorted[upper] * (index - lower);
}

function fmt(ms) { return (ms / 1000).toFixed(2) + ' s'; }

// â”€â”€â”€ Health scoring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function systemHealth(failRate, retryRate, timeoutCount, total) {
  if (failRate >= 20 || retryRate >= 50 || timeoutCount >= Math.max(3, total * 0.1))
    return { label: 'CRITICAL', color: '#c0392b', bg: '#fdecea' };
  if (failRate >= 5 || retryRate >= 20 || timeoutCount >= 1)
    return { label: 'WARNING',  color: '#e67e22', bg: '#fef9e7' };
  return   { label: 'HEALTHY',  color: '#27ae60', bg: '#eafaf1' };
}

// â”€â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function main() {
  if (!fs.existsSync(resultsFile)) {
    console.error('Results file not found:', resultsFile);
    process.exit(1);
  }
  const results  = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
  const total    = results.length;
  const durations = results.map(r => r.duration);

  // â”€â”€ Classifications â”€â”€
  const passes       = results.filter(r => r.status === 'Pass');
  const fails        = results.filter(r => r.status === 'Fail');
  const cleanPasses  = passes.filter(r => !r.retryCount);
  const flakyPasses  = passes.filter(r => r.retryCount > 0);
  const retriedTotal = results.filter(r => r.retryCount > 0).length;
  const timeouts     = results.filter(r => r.errorMsg && r.errorMsg.toLowerCase().includes('timeout'));

  // â”€â”€ Percentiles & throughput â”€â”€
  const avg    = durations.reduce((a, b) => a + b, 0) / (total || 1);
  const median = percentile(durations, 50);
  const p90    = percentile(durations, 90);
  const p95    = percentile(durations, 95);
  const p99    = percentile(durations, 99);
  const maxDur = total ? Math.max(...durations) : 0;
  const minDur = total ? Math.min(...durations) : 0;
  const actualWorkflowsPerMinute = maxDur ? (total / (maxDur / 1000 / 60)) : 0;

  // â”€â”€ Rates â”€â”€
  const errorRate  = (fails.length  / (total || 1)) * 100;
  const retryRate  = (retriedTotal  / (total || 1)) * 100;
  const passRate   = (passes.length / (total || 1)) * 100;
  const timeoutCount = timeouts.length;

  // â”€â”€ Health â”€â”€
  const health = systemHealth(errorRate, retryRate, timeoutCount, total);

  // â”€â”€ Failure breakdown â”€â”€
  const failBreakdown = {};
  for (const r of fails) {
    const cat = classifyError(r) || 'Unknown Error';
    failBreakdown[cat] = (failBreakdown[cat] || 0) + 1;
  }

  // â”€â”€ Execution timeline â”€â”€
  const sortedByDur = [...results].sort((a, b) => a.duration - b.duration);
  const fastestUser  = sortedByDur[0];
  const slowestUser  = sortedByDur[sortedByDur.length - 1];
  const medianIdx    = Math.floor(sortedByDur.length / 2);
  const medianUser   = sortedByDur[medianIdx];

  // â”€â”€ Slow thresholds â”€â”€
  const WARN_S     = 90;
  const CRITICAL_S = 120;

  // â”€â”€ Sort detail rows: Fail â†’ Flaky â†’ Slow â†’ Clean â”€â”€
  const sorted = [...results].sort((a, b) => {
    const rank = r => {
      if (r.status === 'Fail')           return 0;
      if (r.retryCount > 0)             return 1;
      if (r.duration / 1000 > CRITICAL_S) return 2;
      if (r.duration / 1000 > WARN_S)    return 3;
      return 4;
    };
    return rank(a) - rank(b);
  });

  // â”€â”€ Console output (unchanged behaviour) â”€â”€
  console.log('\n--- E2E Workflow Metrics ---');
  console.log(`Total Users:           ${total}`);
  console.log(`Average Duration:      ${(avg / 1000).toFixed(2)} s`);
  console.log(`Median Duration:       ${(median / 1000).toFixed(2)} s`);
  console.log(`90th Percentile (p90): ${(p90 / 1000).toFixed(2)} s`);
  console.log(`95th Percentile (p95): ${(p95 / 1000).toFixed(2)} s`);
  console.log(`99th Percentile (p99): ${(p99 / 1000).toFixed(2)} s`);
  console.log(`Error Rate:            ${errorRate.toFixed(2)} %`);
  console.log(`Retry Rate:            ${retryRate.toFixed(2)} %`);
  console.log(`Timeout Count:         ${timeoutCount}`);
  console.log(`Actual Throughput:     ${actualWorkflowsPerMinute.toFixed(2)} workflows/min`);
  console.log(`Pass Rate:             ${passRate.toFixed(2)} %`);
  console.log(`System Health:         ${health.label}`);
  console.log('-----------------------------\n');

  // â”€â”€ CI metadata â”€â”€
  const runId      = process.env.GITHUB_RUN_ID     || '';
  const serverUrl  = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const repository = process.env.GITHUB_REPOSITORY || '';
  const commitSha  = process.env.GITHUB_SHA        || '';
  const shardCount = process.env.SHARD_COUNT || process.env.TOTAL_SHARDS || '';
  const workerCnt  = process.env.WORKERS            || '';
  const reportTs   = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const runUrl     = runId && repository ? `${serverUrl}/${repository}/actions/runs/${runId}` : '';
  const shortSha   = commitSha ? commitSha.slice(0, 7) : '';

  // â”€â”€ Workflow steps â”€â”€
  const workflowSteps = [
    'Log in to the Family Portal application.',
    'Go to the Renewables page and process actions.',
    'Navigate to the Review Pay Period page.',
    'Navigate to Employer Pay Stub (redirects to PASS page).',
    'Navigate to the Authorizations page.',
    'Navigate to the Reimbursement page.',
    'Navigate to the Denied Timesheet page.',
    'Navigate to the Vendor Timesheet page.',
    'Log out of the application.'
  ];

  // â”€â”€ Executive summary cards HTML â”€â”€
  const cards = [
    { label: 'Total Users',   value: total,                color: '#2c3e50' },
    { label: 'Passed',        value: passes.length,        color: '#27ae60' },
    { label: 'Failed',        value: fails.length,         color: fails.length  ? '#c0392b' : '#27ae60' },
    { label: 'Flaky (Pass*)', value: flakyPasses.length,   color: flakyPasses.length ? '#e67e22' : '#27ae60' },
    { label: 'Retry Rate',    value: retryRate.toFixed(1) + '%', color: retryRate >= 20 ? '#c0392b' : retryRate >= 5 ? '#e67e22' : '#27ae60' },
    { label: 'Timeouts',      value: timeoutCount,         color: timeoutCount ? '#c0392b' : '#27ae60' },
  ].map(c => `
    <div class="card">
      <div class="card-value" style="color:${c.color}">${c.value}</div>
      <div class="card-label">${c.label}</div>
    </div>`).join('');

  // â”€â”€ Failure breakdown rows â”€â”€
  const failBreakdownRows = Object.entries(failBreakdown).length
    ? Object.entries(failBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, cnt]) => `<tr><td>${cat}</td><td>${cnt}</td></tr>`).join('')
    : '<tr><td colspan="2" style="color:#27ae60;text-align:center">No failures â€” all users passed âœ“</td></tr>';

  // â”€â”€ Flaky users rows â”€â”€
  const flakyRows = flakyPasses.length
    ? flakyPasses.map(r => `
      <tr>
        <td class="col-login">${maskUsername(r.username)}</td>
        <td><span class="badge badge-flaky">Pass*</span></td>
        <td>${r.retryCount}</td>
        <td>${(r.duration / 1000).toFixed(3)}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" style="color:#27ae60;text-align:center">No flaky users âœ“</td></tr>';

  // â”€â”€ Timeline rows â”€â”€
  const timelineRows = total ? `
    <tr><td>Fastest</td><td>${maskUsername(fastestUser.username)}</td><td>${(fastestUser.duration/1000).toFixed(3)} s</td></tr>
    <tr><td>Median</td><td>${maskUsername(medianUser.username)}</td><td>${(medianUser.duration/1000).toFixed(3)} s</td></tr>
    <tr><td>Slowest</td><td>${maskUsername(slowestUser.username)}</td><td>${(slowestUser.duration/1000).toFixed(3)} s</td></tr>
  ` : '';

  // â”€â”€ Detail table rows (sorted by severity) â”€â”€
  const userDetailsRows = sorted.map(result => {
    const login       = maskUsername(result.username);
    const durationS   = (result.duration / 1000).toFixed(3);
    const durNum      = result.duration / 1000;
    const isFail      = result.status === 'Fail';
    const isFlaky     = !isFail && result.retryCount > 0;
    const isSlow      = !isFail && durNum > WARN_S;
    const isCritical  = !isFail && durNum > CRITICAL_S;
    const retry       = result.retryCount != null ? result.retryCount : 'â€“';
    const timeoutType = classifyTimeout(result.errorMsg);
    const hasError    = isFail ? 1 : 0;
    const timeoutCell = timeoutType ? `<span class="timeout-label">${timeoutType}</span>` : '0';

    let statusBadge;
    if (isFail)       statusBadge = `<span class="badge badge-fail">Fail</span>`;
    else if (isFlaky) statusBadge = `<span class="badge badge-flaky">Pass*</span>`;
    else              statusBadge = `<span class="badge badge-pass">Pass</span>`;

    let rowClass;
    if (isFail)          rowClass = 'row-fail';
    else if (isFlaky)    rowClass = 'row-flaky';
    else if (isCritical) rowClass = 'row-slow-critical';
    else if (isSlow)     rowClass = 'row-slow-warn';
    else                 rowClass = 'row-clean';

    let durCell = durationS;
    if (isCritical) durCell = `<span class="dur-critical">${durationS}</span>`;
    else if (isSlow) durCell = `<span class="dur-warn">${durationS}</span>`;

    return `<tr class="${rowClass}">
      <td class="col-login">${login}</td>
      <td class="col-status">${statusBadge}</td>
      <td class="col-duration">${durCell}</td>
      <td class="col-retry">${retry}</td>
      <td class="col-error">${hasError}</td>
      <td class="col-timeout">${timeoutCell}</td>
    </tr>`;
  }).join('');

  // â”€â”€ Metadata table â”€â”€
  const metaRows = [
    ['Report Generated', reportTs],
    runUrl     ? ['GitHub Run',       `<a href="${runUrl}" target="_blank">${runUrl}</a>`] : null,
    shortSha   ? ['Commit',           shortSha]   : null,
    shardCount ? ['Shards',           shardCount] : null,
    workerCnt  ? ['Workers per Shard',workerCnt]  : null,
  ].filter(Boolean).map(([k, v]) => `<tr><td><b>${k}</b></td><td>${v}</td></tr>`).join('');

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // HTML
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Family Portal E2E â€” Metrics Report</title>
  <style>
    /* â”€â”€ Reset & base â”€â”€ */
    *, *::before, *::after { box-sizing: border-box; }
    body   { font-family: Arial, sans-serif; margin: 0; padding: 1.5em 2em; background: #f0f2f8; color: #1e1e2e; font-size: 14px; }
    h1     { color: #1a1a2e; font-size: 1.6em; margin-bottom: 0.1em; }
    h2     { color: #1a73e8; font-size: 1.1em; margin: 1.8em 0 0.5em; border-bottom: 2px solid #d0d9f5; padding-bottom: 4px; }
    a      { color: #1a73e8; }
    ul     { margin: 0.3em 0 1.2em 1.2em; }
    li     { margin-bottom: 3px; }

    /* â”€â”€ Tables â”€â”€ */
    table  { border-collapse: collapse; width: 100%; margin-bottom: 1.5em; background: #fff;
             box-shadow: 0 1px 5px rgba(0,0,0,0.08); border-radius: 6px; overflow: hidden; }
    th, td { border: 1px solid #dde3f0; padding: 8px 13px; text-align: left; font-size: 0.93em; }
    th     { background: #2c3e50; color: #fff; font-weight: 600; }
    .summary-table th { background: #e3eafc; color: #1e1e2e; }
    .summary-table tr:nth-child(even) td { background: #f7f9ff; }
    .narrow-table  { width: 55%; }
    .medium-table  { width: 72%; }

    /* â”€â”€ Executive cards â”€â”€ */
    .cards { display: flex; flex-wrap: wrap; gap: 14px; margin: 1em 0 1.8em; }
    .card  { background: #fff; border-radius: 8px; box-shadow: 0 1px 5px rgba(0,0,0,0.09);
             padding: 14px 22px; min-width: 120px; text-align: center; }
    .card-value { font-size: 2em; font-weight: 700; line-height: 1.1; }
    .card-label { font-size: 0.78em; color: #666; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.05em; }

    /* â”€â”€ Health banner â”€â”€ */
    .health-banner { border-radius: 6px; padding: 10px 18px; margin-bottom: 1.5em;
                     font-size: 1em; font-weight: 600; display: flex; align-items: center; gap: 10px; }
    .health-dot    { width: 14px; height: 14px; border-radius: 50%; display: inline-block; }

    /* â”€â”€ Badges â”€â”€ */
    .badge        { display: inline-block; padding: 2px 9px; border-radius: 11px;
                    font-size: 0.8em; font-weight: 700; letter-spacing: 0.03em; }
    .badge-pass   { background: #d4edda; color: #145a32; }
    .badge-fail   { background: #f8d7da; color: #641e16; }
    .badge-flaky  { background: #fef3cd; color: #6e4c00; }

    /* â”€â”€ Timeout label â”€â”€ */
    .timeout-label { display: inline-block; padding: 1px 7px; border-radius: 8px;
                     font-size: 0.77em; background: #fde8c8; color: #7a4000; font-weight: 600; }

    /* â”€â”€ Detail table rows â”€â”€ */
    .detail-table td { text-align: center; }
    .detail-table .col-login { text-align: left; }
    .row-fail          { background: #fdf0f0; }
    .row-flaky         { background: #fefce8; }
    .row-slow-warn     { background: #fff8e1; }
    .row-slow-critical { background: #fff3e0; }
    .row-clean:nth-child(odd)  { background: #fff; }
    .row-clean:nth-child(even) { background: #f7f9ff; }

    /* â”€â”€ Duration highlights â”€â”€ */
    .dur-warn     { color: #b7770d; font-weight: 600; }
    .dur-critical { color: #c0392b; font-weight: 700; }

    /* â”€â”€ Column widths â”€â”€ */
    .col-login    { min-width: 150px; }
    .col-status   { min-width: 72px; }
    .col-duration { min-width: 92px; }
    .col-retry    { min-width: 52px; }
    .col-error    { min-width: 58px; }
    .col-timeout  { min-width: 90px; }

    /* â”€â”€ Info / explanation boxes â”€â”€ */
    .meta-box    { background: #eef2fb; border: 1px solid #c5d0f0; border-radius: 6px;
                   padding: 0.7em 1.1em; margin-bottom: 1.3em; font-size: 0.88em; }
    .meta-box table { width: auto; box-shadow: none; margin-bottom: 0; background: transparent; }
    .meta-box th, .meta-box td { border: none; padding: 3px 14px 3px 0; background: transparent;
                                  color: #1e1e2e; font-size: 0.93em; }
    .explanation { background: #eaf6fb; border-left: 4px solid #1a73e8; padding: 0.9em 1em;
                   margin-bottom: 1.5em; border-radius: 0 6px 6px 0; }
    .legend      { font-size: 0.83em; margin-bottom: 0.6em; }
    .legend span { margin-right: 1em; }
    .section-intro { color: #555; font-size: 0.88em; margin: -0.3em 0 0.8em; }

    /* â”€â”€ Print / PDF safety â”€â”€ */
    @media print {
      body { background: #fff; padding: 1em; }
      .cards { page-break-inside: avoid; }
      table  { page-break-inside: auto; }
      tr     { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

<h1>Family Portal â€” E2E Automation Report</h1>
<p style="color:#666;margin-top:0;font-size:0.88em">Distributed Playwright execution Â· ${reportTs}</p>

<!-- â”€â”€ 1. EXECUTIVE SUMMARY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
<h2>Executive Summary</h2>
<div class="cards">${cards}</div>

<!-- â”€â”€ 2. SYSTEM HEALTH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
<h2>System Health</h2>
<div class="health-banner" style="background:${health.bg};color:${health.color};border:1.5px solid ${health.color}">
  <div class="health-dot" style="background:${health.color}"></div>
  ${health.label}
  ${health.label !== 'HEALTHY' ? `&nbsp;Â·&nbsp;
    ${errorRate >= 20   ? `Failure rate ${errorRate.toFixed(1)}% â‰¥ 20%` :
      retryRate >= 20   ? `Retry rate ${retryRate.toFixed(1)}% â‰¥ 20%`  :
      timeoutCount >= 1 ? `${timeoutCount} timeout(s) detected`         : ''}` : '&nbsp;â€” all thresholds within acceptable limits'}
</div>

<!-- â”€â”€ 3. PERFORMANCE METRICS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
<h2>Performance Metrics</h2>
<table class="summary-table medium-table">
  <tr><th>Metric</th><th>Value</th></tr>
  <tr><td>Total Users</td><td>${total}</td></tr>
  <tr><td>Passed (Clean first attempt)</td><td>${cleanPasses.length}</td></tr>
  <tr><td>Passed (Flaky â€” needed retry)</td><td>${flakyPasses.length}</td></tr>
  <tr><td>Failed</td><td>${fails.length}</td></tr>
  <tr><td>Total Retried</td><td>${retriedTotal} / ${total} (${retryRate.toFixed(1)}%)</td></tr>
  <tr><td>Pass Rate</td><td>${passRate.toFixed(2)} %</td></tr>
  <tr><td>Error Rate</td><td>${errorRate.toFixed(2)} %</td></tr>
  <tr><td>Timeout Count</td><td>${timeoutCount}</td></tr>
  <tr><td>Average Duration</td><td>${fmt(avg)}</td></tr>
  <tr><td>Median Duration (p50)</td><td>${fmt(median)}</td></tr>
  <tr><td>90th Percentile (p90)</td><td>${fmt(p90)}</td></tr>
  <tr><td>95th Percentile (p95)</td><td>${fmt(p95)}</td></tr>
  <tr><td>99th Percentile (p99)</td><td>${fmt(p99)}</td></tr>
  <tr><td>Actual Execution Throughput</td><td>${actualWorkflowsPerMinute.toFixed(2)} workflows/min</td></tr>
</table>

<!-- â”€â”€ 4. EXECUTION TIMELINE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
<h2>Execution Timeline</h2>
<p class="section-intro">Best, median, and worst individual user execution times.</p>
<table class="summary-table narrow-table">
  <tr><th>Position</th><th>User</th><th>Actual Execution Time</th></tr>
  ${timelineRows}
</table>

<!-- â”€â”€ 5. FAILURE BREAKDOWN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
<h2>Failure Breakdown</h2>
<p class="section-intro">Categorised by root cause for operational diagnosis.</p>
<table class="summary-table narrow-table">
  <tr><th>Category</th><th>Count</th></tr>
  ${failBreakdownRows}
</table>

<!-- â”€â”€ 6. FLAKY USERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
<h2>Flaky Users <span style="font-weight:400;font-size:0.85em;color:#856404">(passed only after retry)</span></h2>
<p class="section-intro">These users ultimately succeeded but required a Playwright retry. Investigate for intermittent instability.</p>
<table class="summary-table">
  <tr><th>Login</th><th>Final Status</th><th>Retry Count</th><th>Actual Execution Time (s)</th></tr>
  ${flakyRows}
</table>

<!-- â”€â”€ 7. DETAILED USER RESULTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
<h2>Detailed User Results</h2>
<p class="section-intro">Sorted by severity: Failed â†’ Flaky â†’ Slow â†’ Clean. Duration highlights: <span class="dur-warn">â‰¥ ${WARN_S}s warning</span> Â· <span class="dur-critical">â‰¥ ${CRITICAL_S}s critical</span>.</p>
<div class="legend">
  <span><span class="badge badge-pass">Pass</span> Clean pass</span>
  <span><span class="badge badge-flaky">Pass*</span> Passed after retry</span>
  <span><span class="badge badge-fail">Fail</span> Failed final attempt</span>
  <span><span class="timeout-label">Locator</span> Timeout type</span>
</div>
<table class="detail-table">
  <tr>
    <th class="col-login">Login</th>
    <th class="col-status">Status</th>
    <th class="col-duration">Execution Time (s)</th>
    <th class="col-retry">Retry</th>
    <th class="col-error">Error</th>
    <th class="col-timeout">Timeout</th>
  </tr>
  ${userDetailsRows}
</table>

<!-- â”€â”€ 8. WORKFLOW STEPS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
<h2>Automated Workflow Steps</h2>
<ul>${workflowSteps.map(s => `<li>${s}</li>`).join('')}</ul>

<!-- â”€â”€ 9. ENVIRONMENT METADATA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
<h2>Environment &amp; Run Metadata</h2>
<div class="meta-box">
  <table>
    ${metaRows || '<tr><td>Local run â€” no CI metadata available</td></tr>'}
  </table>
</div>

<!-- â”€â”€ 10. HOW TO READ THIS REPORT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
<div class="explanation">
  <strong>How to read this report</strong>
  <ul>
    <li><b>Login:</b> Privacy-masked username (jo***@domain.com) â€” first two chars + *** preserved for PDF readability.</li>
    <li><b>Status:</b> Final attempt result. <b>Pass*</b> = passed only after a Playwright retry (flaky).</li>
    <li><b>Execution Time (s):</b> Wall-clock seconds for this user's <em>final</em> attempt â€” not an average.</li>
    <li><b>Retry:</b> 0 = first attempt succeeded or failed; 1 = Playwright triggered one retry.</li>
    <li><b>Error:</b> 1 if the final attempt threw an uncaught exception or failed assertion.</li>
    <li><b>Timeout:</b> Type of timeout that caused failure â€” Locator / Navigation / Assertion / Global / Action.</li>
    <li><b>Actual Execution Throughput:</b> Total users Ã· longest single test duration (parallel approximation).</li>
    <li><b>p90/p95/p99:</b> SLA indicators â€” 90%/95%/99% of users finished within this time (linear interpolation).</li>
    <li><b>System Health:</b> HEALTHY = fail rate &lt;5% &amp; retry rate &lt;20% &amp; no timeouts. WARNING / CRITICAL indicate thresholds exceeded.</li>
  </ul>
</div>

</body>
</html>`;

  fs.writeFileSync(htmlReportFile, html, 'utf-8');
  console.log(`HTML report generated at: ${htmlReportFile}`);
}

main();


