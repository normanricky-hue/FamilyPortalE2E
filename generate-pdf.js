// generate-pdf.js
// Usage: node generate-pdf.js
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function generatePDF() {
  const htmlPath = path.join(__dirname, 'results', 'report.html');
  const pdfPath = path.join(__dirname, 'results', 'report.pdf');

  if (!fs.existsSync(htmlPath)) {
    console.error('HTML report not found:', htmlPath);
    process.exit(1);
  }

  console.log('Generating PDF report...');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Load the HTML file
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  
  // Generate PDF
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20px',
      right: '20px',
      bottom: '20px',
      left: '20px'
    }
  });
  
  await browser.close();
  
  console.log(`PDF report generated at: ${pdfPath}`);
}

generatePDF().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
