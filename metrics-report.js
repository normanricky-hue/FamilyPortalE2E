// metrics-report.js — Phase-9: Observability dashboard report
// Usage: node metrics-report.js
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const resultsFile   = path.join(__dirname, 'results', 'test_results.json');
const htmlReportFile = path.join(__dirname, 'results', 'report.html');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Mask username for privacy + PDF readability: john.doe@gmail.com → jo***@gmail.com */
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

// ─── Health scoring ───────────────────────────────────────────────────────────

function systemHealth(failRate, retryRate, timeoutCount, total) {
  if (failRate >= 20 || retryRate >= 50 || timeoutCount >= Math.max(3, total * 0.1))
    return { label: 'CRITICAL', color: '#c0392b', bg: '#fdecea' };
  if (failRate >= 5 || retryRate >= 20 || timeoutCount >= 1)
    return { label: 'WARNING',  color: '#e67e22', bg: '#fef9e7' };
  return   { label: 'HEALTHY',  color: '#27ae60', bg: '#eafaf1' };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(resultsFile)) {
    console.error('Results file not found:', resultsFile);
    process.exit(1);
  }
  const results  = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
  const total    = results.length;
  const durations = results.map(r => r.duration);

  // ── Classifications ──
  const passes       = results.filter(r => r.status === 'Pass');
  const fails        = results.filter(r => r.status === 'Fail');
  const cleanPasses  = passes.filter(r => !r.retryCount);
  const flakyPasses  = passes.filter(r => r.retryCount > 0);
  const retriedTotal = results.filter(r => r.retryCount > 0).length;
  const timeouts     = results.filter(r => r.errorMsg && r.errorMsg.toLowerCase().includes('timeout'));

  // ── Percentiles & throughput ──
  const avg    = durations.reduce((a, b) => a + b, 0) / (total || 1);
  const median = percentile(durations, 50);
  const p90    = percentile(durations, 90);
  const p95    = percentile(durations, 95);
  const p99    = percentile(durations, 99);
  const maxDur = total ? Math.max(...durations) : 0;
  const minDur = total ? Math.min(...durations) : 0;
  const actualWorkflowsPerMinute = maxDur ? (total / (maxDur / 1000 / 60)) : 0;

  // ── Rates ──
  const errorRate  = (fails.length  / (total || 1)) * 100;
  const retryRate  = (retriedTotal  / (total || 1)) * 100;
  const passRate   = (passes.length / (total || 1)) * 100;
  const timeoutCount = timeouts.length;

  // ── Health ──
  const health = systemHealth(errorRate, retryRate, timeoutCount, total);

  // ── Failure breakdown ──
  const failBreakdown = {};
  for (const r of fails) {
    const cat = classifyError(r) || 'Unknown Error';
    failBreakdown[cat] = (failBreakdown[cat] || 0) + 1;
  }

  // ── Execution timeline ──
  const sortedByDur = [...results].sort((a, b) => a.duration - b.duration);
  const fastestUser  = sortedByDur[0];
  const slowestUser  = sortedByDur[sortedByDur.length - 1];
  const medianIdx    = Math.floor(sortedByDur.length / 2);
  const medianUser   = sortedByDur[medianIdx];

  // ── Slow thresholds ──
  const WARN_S     = 90;
  const CRITICAL_S = 120;

  // ── Sort detail rows: Fail → Flaky → Slow → Clean ──
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

  // ── Console output (unchanged behaviour) ──
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

  // ── CI metadata ──
  const runId      = process.env.GITHUB_RUN_ID     || '';
  const serverUrl  = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const repository = process.env.GITHUB_REPOSITORY || '';
  const commitSha  = process.env.GITHUB_SHA        || '';
  const shardCount = process.env.SHARD_COUNT || process.env.TOTAL_SHARDS || '';
  const workerCnt  = process.env.WORKERS            || '';
  const reportTs   = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const runUrl     = runId && repository ? `${serverUrl}/${repository}/actions/runs/${runId}` : '';
  const shortSha   = commitSha ? commitSha.slice(0, 7) : '';

  // ── Workflow steps ──
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

  // ── Executive summary cards HTML ──
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

  // ── Failure breakdown rows ──
  const failBreakdownRows = Object.entries(failBreakdown).length
    ? Object.entries(failBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, cnt]) => `<tr><td>${cat}</td><td>${cnt}</td></tr>`).join('')
    : '<tr><td colspan="2" style="color:#27ae60;text-align:center">No failures — all users passed ✓</td></tr>';

  // ── Flaky users rows ──
  const flakyRows = flakyPasses.length
    ? flakyPasses.map(r => `
      <tr>
        <td class="col-login">${maskUsername(r.username)}</td>
        <td><span class="badge badge-flaky">Pass*</span></td>
        <td>${r.retryCount}</td>
        <td>${(r.duration / 1000).toFixed(3)}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" style="color:#27ae60;text-align:center">No flaky users ✓</td></tr>';

  // ── Timeline rows ──
  const timelineRows = total ? `
    <tr><td>Fastest</td><td>${maskUsername(fastestUser.username)}</td><td>${(fastestUser.duration/1000).toFixed(3)} s</td></tr>
    <tr><td>Median</td><td>${maskUsername(medianUser.username)}</td><td>${(medianUser.duration/1000).toFixed(3)} s</td></tr>
    <tr><td>Slowest</td><td>${maskUsername(slowestUser.username)}</td><td>${(slowestUser.duration/1000).toFixed(3)} s</td></tr>
  ` : '';

  // ── Detail table rows (sorted by severity) ──
  const userDetailsRows = sorted.map(result => {
    const login       = maskUsername(result.username);
    const durationS   = (result.duration / 1000).toFixed(3);
    const durNum      = result.duration / 1000;
    const isFail      = result.status === 'Fail';
    const isFlaky     = !isFail && result.retryCount > 0;
    const isSlow      = !isFail && durNum > WARN_S;
    const isCritical  = !isFail && durNum > CRITICAL_S;
    const retry       = result.retryCount != null ? result.retryCount : '–';
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

  // ── Metadata table ──
  const metaRows = [
    ['Report Generated', reportTs],
    runUrl     ? ['GitHub Run',       `<a href="${runUrl}" target="_blank">${runUrl}</a>`] : null,
    shortSha   ? ['Commit',           shortSha]   : null,
    shardCount ? ['Shards',           shardCount] : null,
    workerCnt  ? ['Workers per Shard',workerCnt]  : null,
  ].filter(Boolean).map(([k, v]) => `<tr><td><b>${k}</b></td><td>${v}</td></tr>`).join('');

  // ═══════════════════════════════════════════════════════════════════════════
  // HTML
  // ═══════════════════════════════════════════════════════════════════════════
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Family Portal E2E — Metrics Report</title>
  <style>
    /* ── Reset & base ── */
    *, *::before, *::after { box-sizing: border-box; }
    body   { font-family: Arial, sans-serif; margin: 0; padding: 1.5em 2em; background: #f0f2f8; color: #1e1e2e; font-size: 14px; }
    h1     { color: #1a1a2e; font-size: 1.6em; margin-bottom: 0.1em; }
    h2     { color: #1a73e8; font-size: 1.1em; margin: 1.8em 0 0.5em; border-bottom: 2px solid #d0d9f5; padding-bottom: 4px; }
    a      { color: #1a73e8; }
    ul     { margin: 0.3em 0 1.2em 1.2em; }
    li     { margin-bottom: 3px; }

    /* ── Tables ── */
    table  { border-collapse: collapse; width: 100%; margin-bottom: 1.5em; background: #fff;
             box-shadow: 0 1px 5px rgba(0,0,0,0.08); border-radius: 6px; overflow: hidden; }
    th, td { border: 1px solid #dde3f0; padding: 8px 13px; text-align: left; font-size: 0.93em; }
    th     { background: #2c3e50; color: #fff; font-weight: 600; }
    .summary-table th { background: #e3eafc; color: #1e1e2e; }
    .summary-table tr:nth-child(even) td { background: #f7f9ff; }
    .narrow-table  { width: 55%; }
    .medium-table  { width: 72%; }

    /* ── Executive cards ── */
    .cards { display: flex; flex-wrap: wrap; gap: 14px; margin: 1em 0 1.8em; }
    .card  { background: #fff; border-radius: 8px; box-shadow: 0 1px 5px rgba(0,0,0,0.09);
             padding: 14px 22px; min-width: 120px; text-align: center; }
    .card-value { font-size: 2em; font-weight: 700; line-height: 1.1; }
    .card-label { font-size: 0.78em; color: #666; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.05em; }

    /* ── Health banner ── */
    .health-banner { border-radius: 6px; padding: 10px 18px; margin-bottom: 1.5em;
                     font-size: 1em; font-weight: 600; display: flex; align-items: center; gap: 10px; }
    .health-dot    { width: 14px; height: 14px; border-radius: 50%; display: inline-block; }

    /* ── Badges ── */
    .badge        { display: inline-block; padding: 2px 9px; border-radius: 11px;
                    font-size: 0.8em; font-weight: 700; letter-spacing: 0.03em; }
    .badge-pass   { background: #d4edda; color: #145a32; }
    .badge-fail   { background: #f8d7da; color: #641e16; }
    .badge-flaky  { background: #fef3cd; color: #6e4c00; }

    /* ── Timeout label ── */
    .timeout-label { display: inline-block; padding: 1px 7px; border-radius: 8px;
                     font-size: 0.77em; background: #fde8c8; color: #7a4000; font-weight: 600; }

    /* ── Detail table rows ── */
    .detail-table td { text-align: center; }
    .detail-table .col-login { text-align: left; }
    .row-fail          { background: #fdf0f0; }
    .row-flaky         { background: #fefce8; }
    .row-slow-warn     { background: #fff8e1; }
    .row-slow-critical { background: #fff3e0; }
    .row-clean:nth-child(odd)  { background: #fff; }
    .row-clean:nth-child(even) { background: #f7f9ff; }

    /* ── Duration highlights ── */
    .dur-warn     { color: #b7770d; font-weight: 600; }
    .dur-critical { color: #c0392b; font-weight: 700; }

    /* ── Column widths ── */
    .col-login    { min-width: 150px; }
    .col-status   { min-width: 72px; }
    .col-duration { min-width: 92px; }
    .col-retry    { min-width: 52px; }
    .col-error    { min-width: 58px; }
    .col-timeout  { min-width: 90px; }

    /* ── Info / explanation boxes ── */
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

    /* ── Print / PDF safety ── */
    @media print {
      body { background: #fff; padding: 1em; }
      .cards { page-break-inside: avoid; }
      table  { page-break-inside: auto; }
      tr     { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

<h1>Family Portal — E2E Automation Report</h1>
<p style="color:#666;margin-top:0;font-size:0.88em">Distributed Playwright execution · ${reportTs}</p>

<!-- ── 1. EXECUTIVE SUMMARY ───────────────────────────────────────────── -->
<h2>Executive Summary</h2>
<div class="cards">${cards}</div>

<!-- ── 2. SYSTEM HEALTH ───────────────────────────────────────────────── -->
<h2>System Health</h2>
<div class="health-banner" style="background:${health.bg};color:${health.color};border:1.5px solid ${health.color}">
  <div class="health-dot" style="background:${health.color}"></div>
  ${health.label}
  ${health.label !== 'HEALTHY' ? `&nbsp;·&nbsp;
    ${errorRate >= 20   ? `Failure rate ${errorRate.toFixed(1)}% ≥ 20%` :
      retryRate >= 20   ? `Retry rate ${retryRate.toFixed(1)}% ≥ 20%`  :
      timeoutCount >= 1 ? `${timeoutCount} timeout(s) detected`         : ''}` : '&nbsp;— all thresholds within acceptable limits'}
</div>

<!-- ── 3. PERFORMANCE METRICS ─────────────────────────────────────────── -->
<h2>Performance Metrics</h2>
<table class="summary-table medium-table">
  <tr><th>Metric</th><th>Value</th></tr>
  <tr><td>Total Users</td><td>${total}</td></tr>
  <tr><td>Passed (Clean first attempt)</td><td>${cleanPasses.length}</td></tr>
  <tr><td>Passed (Flaky — needed retry)</td><td>${flakyPasses.length}</td></tr>
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

<!-- ── 4. EXECUTION TIMELINE ─────────────────────────────────────────── -->
<h2>Execution Timeline</h2>
<p class="section-intro">Best, median, and worst individual user execution times.</p>
<table class="summary-table narrow-table">
  <tr><th>Position</th><th>User</th><th>Actual Execution Time</th></tr>
  ${timelineRows}
</table>

<!-- ── 5. FAILURE BREAKDOWN ───────────────────────────────────────────── -->
<h2>Failure Breakdown</h2>
<p class="section-intro">Categorised by root cause for operational diagnosis.</p>
<table class="summary-table narrow-table">
  <tr><th>Category</th><th>Count</th></tr>
  ${failBreakdownRows}
</table>

<!-- ── 6. FLAKY USERS ─────────────────────────────────────────────────── -->
<h2>Flaky Users <span style="font-weight:400;font-size:0.85em;color:#856404">(passed only after retry)</span></h2>
<p class="section-intro">These users ultimately succeeded but required a Playwright retry. Investigate for intermittent instability.</p>
<table class="summary-table">
  <tr><th>Login</th><th>Final Status</th><th>Retry Count</th><th>Actual Execution Time (s)</th></tr>
  ${flakyRows}
</table>

<!-- ── 7. DETAILED USER RESULTS ───────────────────────────────────────── -->
<h2>Detailed User Results</h2>
<p class="section-intro">Sorted by severity: Failed → Flaky → Slow → Clean. Duration highlights: <span class="dur-warn">≥ ${WARN_S}s warning</span> · <span class="dur-critical">≥ ${CRITICAL_S}s critical</span>.</p>
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

<!-- ── 8. WORKFLOW STEPS ───────────────────────────────────────────────── -->
<h2>Automated Workflow Steps</h2>
<ul>${workflowSteps.map(s => `<li>${s}</li>`).join('')}</ul>

<!-- ── 9. ENVIRONMENT METADATA ─────────────────────────────────────────── -->
<h2>Environment &amp; Run Metadata</h2>
<div class="meta-box">
  <table>
    ${metaRows || '<tr><td>Local run — no CI metadata available</td></tr>'}
  </table>
</div>

<!-- ── 10. HOW TO READ THIS REPORT ─────────────────────────────────────── -->
<div class="explanation">
  <strong>How to read this report</strong>
  <ul>
    <li><b>Login:</b> Privacy-masked username (jo***@domain.com) — first two chars + *** preserved for PDF readability.</li>
    <li><b>Status:</b> Final attempt result. <b>Pass*</b> = passed only after a Playwright retry (flaky).</li>
    <li><b>Execution Time (s):</b> Wall-clock seconds for this user's <em>final</em> attempt — not an average.</li>
    <li><b>Retry:</b> 0 = first attempt succeeded or failed; 1 = Playwright triggered one retry.</li>
    <li><b>Error:</b> 1 if the final attempt threw an uncaught exception or failed assertion.</li>
    <li><b>Timeout:</b> Type of timeout that caused failure — Locator / Navigation / Assertion / Global / Action.</li>
    <li><b>Actual Execution Throughput:</b> Total users ÷ longest single test duration (parallel approximation).</li>
    <li><b>p90/p95/p99:</b> SLA indicators — 90%/95%/99% of users finished within this time (linear interpolation).</li>
    <li><b>System Health:</b> HEALTHY = fail rate &lt;5% &amp; retry rate &lt;20% &amp; no timeouts. WARNING / CRITICAL indicate thresholds exceeded.</li>
  </ul>
</div>

</body>
</html>`;

  fs.writeFileSync(htmlReportFile, html, 'utf-8');
  console.log(`HTML report generated at: ${htmlReportFile}`);
}

main();



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
