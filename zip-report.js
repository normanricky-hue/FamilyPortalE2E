const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const output = fs.createWriteStream('playwright-report.zip');
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', function() {
  console.log('Zipped:', archive.pointer() + ' total bytes');
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

// Add the Playwright HTML report directory
archive.directory('playwright-report/', false);

// Add the metrics PDF report if it exists
const pdfPath = path.join(__dirname, 'results', 'report.pdf');
if (fs.existsSync(pdfPath)) {
  archive.file(pdfPath, { name: 'metrics-report.pdf' });
  console.log('Added metrics-report.pdf to zip');
}

// Add the metrics HTML report if it exists
const htmlPath = path.join(__dirname, 'results', 'report.html');
if (fs.existsSync(htmlPath)) {
  archive.file(htmlPath, { name: 'metrics-report.html' });
  console.log('Added metrics-report.html to zip');
}

archive.finalize();
