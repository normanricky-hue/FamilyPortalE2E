const fs = require('fs');
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
archive.directory('playwright-report/', false);
archive.finalize();
