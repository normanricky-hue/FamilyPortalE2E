// send-report.js
// Usage: node send-report.js
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');


// Paths to attachments
const zipPath = path.join(__dirname, 'playwright-report.zip');
const pdfPath = path.join(__dirname, 'results', 'report.pdf');
const htmlPath = path.join(__dirname, 'results', 'report.html');

// Prepare email body with download links
const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px; }
    .container { background: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto; }
    h1 { color: #2c3e50; }
    p { color: #333; line-height: 1.6; }
    .btn { display: inline-block; padding: 12px 24px; margin: 10px 5px; background: #1a73e8; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .btn:hover { background: #1557b0; }
    .btn-secondary { background: #34a853; }
    .btn-secondary:hover { background: #2d8e47; }
    .info { background: #eaf6fb; border-left: 4px solid #1a73e8; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>E2E Workflow Metrics Report</h1>
    <p>Hello,</p>
    <p>The automated E2E workflow test has been completed for the Family Portal application. Please find the reports attached to this email.</p>
    
    <div class="info">
      <strong>📊 Attached Reports:</strong>
      <ul>
        <li><strong>Metrics Report (PDF)</strong> - Performance summary and user-wise details</li>
        <li><strong>Playwright Report (ZIP)</strong> - Detailed test execution report with screenshots and traces</li>
      </ul>
    </div>
    
    <p><strong>Quick Access:</strong></p>
    <p>
      <a href="cid:metricsReport" class="btn">📄 View Metrics Report (PDF)</a>
      <a href="cid:playwrightReport" class="btn btn-secondary">📦 Download Full Report (ZIP)</a>
    </p>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      <em>Note: The PDF report contains an executive summary with overall metrics and detailed per-user performance data. The ZIP file contains the complete Playwright HTML report with test execution details.</em>
    </p>
    
    <p>Best regards,<br>Automation Team</p>
  </div>
</body>
</html>
`;

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'norman.ricky@grasko.com',
    pass: ''
  }
});


const attachments = [
  {
    filename: 'playwright-report.zip',
    path: zipPath,
    cid: 'playwrightReport'
  }
];

// Add PDF if it exists
if (fs.existsSync(pdfPath)) {
  attachments.push({
    filename: 'metrics-report.pdf',
    path: pdfPath,
    cid: 'metricsReport'
  });
  console.log('PDF report found, adding to attachments');
} else {
  console.warn('PDF report not found, sending without PDF attachment');
}

const mailOptions = {
  from: 'norman.ricky@grasko.com',
  to: 'rsimmons@kanrad.com',
  subject: 'E2E Workflow Metrics Report - Family Portal',
  html: emailBody,
  attachments: attachments
};


transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('Error sending email:', error);
    // Do not exit the process, just set exit code for parent script
    process.exitCode = 2;
  } else {
    console.log('Report email sent:', info.response);
    process.exitCode = 0;
  }
});
