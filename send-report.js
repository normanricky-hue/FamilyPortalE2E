// send-report.js
// Usage: node send-report.js
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');


// Path to the zipped Playwright report
const zipPath = path.join(__dirname, 'playwright-report.zip');
let htmlContent = '';
try {
  // Optionally, still read the HTML report if you want to include it in the email body
  const htmlPath = path.join(__dirname, 'results', 'report.html');
  htmlContent = fs.readFileSync(htmlPath, 'utf-8');
} catch (e) {
  console.warn('HTML report not found, sending only zip attachment.');
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'norman.ricky@grasko.com',
    pass: ''
  }
});


const mailOptions = {
  from: 'norman.ricky@grasko.com',
  to: 'nagolurameshreddy@gmail.com',
  subject: 'E2E Workflow Metrics Report',
  html: htmlContent || 'Please find the attached Playwright HTML report as a zip file.',
  attachments: [
    {
      filename: 'playwright-report.zip',
      path: zipPath
    }
  ]
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
