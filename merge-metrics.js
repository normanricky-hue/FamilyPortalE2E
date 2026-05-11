// merge-metrics.js
// Usage: node merge-metrics.js
//
// Reads all partial result files from results/partials/*.json,
// merges them into a single results/test_results.json.
//
// Designed to be shard-ready: in a future multi-runner setup, partial files
// from all runners can be placed into results/partials/ before this step runs.

const fs = require('fs');
const path = require('path');

const partialsDir = path.join(__dirname, 'results', 'partials');
const outputFile = path.join(__dirname, 'results', 'test_results.json');

function mergeMetrics() {
  if (!fs.existsSync(partialsDir)) {
    console.error(`[merge-metrics] Partials directory not found: ${partialsDir}`);
    console.error('[merge-metrics] Ensure tests ran and produced partial result files.');
    process.exit(1);
  }

  const partialFiles = fs
    .readdirSync(partialsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(partialsDir, f));

  if (partialFiles.length === 0) {
    console.warn('[merge-metrics] No partial result files found in:', partialsDir);
    console.warn('[merge-metrics] Writing empty results — metrics report will show 0 users.');
    fs.writeFileSync(outputFile, '[]', 'utf-8');
    return;
  }

  const merged = [];

  for (const file of partialFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const records = JSON.parse(content);

      if (!Array.isArray(records)) {
        console.warn(`[merge-metrics] Skipping non-array content in: ${file}`);
        continue;
      }

      merged.push(...records);
    } catch (err) {
      console.warn(`[merge-metrics] Failed to parse ${file}: ${err.message}. Skipping.`);
    }
  }

  // Write merged results — preserves exact JSON structure consumed by metrics-report.js
  fs.writeFileSync(outputFile, JSON.stringify(merged, null, 2), 'utf-8');

  console.log(`[merge-metrics] Merged ${partialFiles.length} partial file(s) → ${merged.length} total record(s)`);
  console.log(`[merge-metrics] Output written to: ${outputFile}`);
}

mergeMetrics();
