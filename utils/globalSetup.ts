import fs from 'fs';
import path from 'path';

/**
 * Playwright globalSetup — runs ONCE in the master process before any worker starts.
 * - Cleans up stale lock files from previous runs.
 * - Recreates results/partials/ so each worker writes to a fresh isolated file.
 * - Initializes results/test_results.json as an empty array (consumed by metrics pipeline).
 */
export default async function globalSetup() {
  const resultsDir = path.resolve(__dirname, '../results');
  const partialsDir = path.join(resultsDir, 'partials');
  const resultsFile = path.join(resultsDir, 'test_results.json');
  const lockFile = path.join(resultsDir, 'test_results.lock');

  // Ensure results directory exists
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Remove stale lock file from any previous crashed run
  if (fs.existsSync(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
      console.log('[globalSetup] Removed stale lock file from previous run.');
    } catch {
      // Already gone — no action needed
    }
  }

  // Recreate partials directory — each worker will write its own isolated file here
  if (fs.existsSync(partialsDir)) {
    fs.rmSync(partialsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(partialsDir, { recursive: true });
  console.log(`[globalSetup] Recreated partials directory: ${partialsDir}`);

  // Initialize final results file — will be populated by merge-metrics.js after tests complete
  fs.writeFileSync(resultsFile, '[]', 'utf-8');
  console.log(`[globalSetup] Initialized results file: ${resultsFile}`);
}
