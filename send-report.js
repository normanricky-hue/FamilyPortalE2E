// send-report.js
// Usage: node send-report.js
//
// Sends a lightweight notification email with:
//   - Metrics summary PDF attached (small, always email-safe)
//   - Link to GitHub Actions run for full Playwright report download
//
// The full playwright-report.zip is intentionally NOT attached to avoid
// Gmail's 25 MB attachment limit. Users download large artifacts from GitHub.

require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const pdfPath = path.join(__dirname, 'results', 'report.pdf');

// GitHub context — populated by GitHub Actions env block; empty when run locally
const githubRunId      = process.env.GITHUB_RUN_ID      || '';
const githubServerUrl  = process.env.GITHUB_SERVER_URL  || 'https://github.com';
const githubRepository = process.env.GITHUB_REPOSITORY  || '';

const artifactBaseUrl = githubRunId && githubRepository
  ? `${githubServerUrl}/${githubRepository}/actions/runs/${githubRunId}`
  : null;

// Build artifact section for the email body
const artifactSection = artifactBaseUrl
  ? `
    <div class="info">
      <strong>📦 Full Report Artifacts (GitHub Actions):</strong><br><br>
      The complete Playwright HTML report, raw test results JSON, and ZIP archive
      are available directly from the GitHub Actions run — no attachment size limits.<br><br>
      <a href="${artifactBaseUrl}" class="btn btn-secondary" style="color:white;">
        🔗 View All Artifacts on GitHub
      </a>
      <br><br>
      <small style="color:#555;">
        Run ID: <code>${githubRunId}</code><br>
        Navigate to the run page → <strong>Artifacts</strong> section to download:
        <ul>
          <li><code>playwright-report-final-${githubRunId}</code> — Full HTML report</li>
          <li><code>metrics-pdf-final-${githubRunId}</code> — Metrics PDF</li>
          <li><code>test-results-json-final-${githubRunId}</code> — Raw JSON results</li>
        </ul>
      </small>
    </div>`
  : `
    <div class="info">
      <strong>📦 Full Report:</strong> Run via GitHub Actions to get artifact links,
      or check the <code>playwright-report/</code> folder on your local machine.
    </div>`;

const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px; }
    .container { background: white; padding: 30px; border-radius: 8px; max-width: 640px; margin: 0 auto; }
    h1 { color: #2c3e50; }
    p { color: #333; line-height: 1.6; }
    .btn { display: inline-block; padding: 12px 24px; margin: 10px 5px; background: #1a73e8; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .btn-secondary { background: #34a853; }
    .info { background: #eaf6fb; border-left: 4px solid #1a73e8; padding: 15px; margin: 20px 0; }
    code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; font-size: 13px; }
    ul { margin: 8px 0; padding-left: 20px; }
    li { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>E2E Workflow Metrics Report</h1>
    <p>Hello,</p>
    <p>The automated E2E workflow test has completed for the Family Portal application.</p>

    <div class="info">
      <strong>📊 Attached to this email:</strong>
      <ul>
        <li><strong>Metrics Report (PDF)</strong> — Performance summary with p50/p90/p95/p99, pass rate, error rate, and per-user details</li>
      </ul>
    </div>

    ${artifactSection}

    <p style="color:#666; font-size:13px; margin-top:30px;">
      <em>Large artifacts (Playwright HTML report, screenshots, traces, ZIP) are stored in GitHub Actions
      to stay within email size limits. The PDF attached here is a lightweight executive summary.</em>
    </p>

    <p>Best regards,<br>Automation Team</p>
  </div>
</body>
</html>
`;

const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;

if (!emailUser || !emailPass) {
  console.error('EMAIL_USER or EMAIL_PASS is not set. Check your .env file or GitHub Actions secrets.');
  process.exitCode = 2;
  process.exit(2);
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: emailUser,
    pass: emailPass
  }
});

// Attachments: PDF only (lightweight, always email-safe)
// The playwright-report.zip is intentionally excluded — too large for Gmail (25MB limit).
const attachments = [];

if (fs.existsSync(pdfPath)) {
  attachments.push({
    filename: 'metrics-report.pdf',
    path: pdfPath,
    cid: 'metricsReport'
  });
  console.log('PDF report found, attaching to email.');
} else {
  console.warn('PDF report not found — sending email without attachment.');
}

const mailOptions = {
  from: emailUser,
  to: process.env.EMAIL_TO || emailUser,
  subject: 'E2E Workflow Metrics Report - Family Portal',
  html: emailBody,
  attachments
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('Error sending email:', error);
    process.exitCode = 2;
  } else {
    console.log('Report email sent:', info.response);
    process.exitCode = 0;
  }
});

