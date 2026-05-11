import fs from 'fs';
import path from 'path';

/**
 * Playwright globalSetup — runs ONCE in the master process before any worker starts.
 * Initializes the results file safely, avoiding the beforeAll-per-worker race condition.
 */
export default async function globalSetup() {
  const resultsDir = path.resolve(__dirname, '../results');
  const resultsFile = path.join(resultsDir, 'test_results.json');
  const lockFile = path.join(resultsDir, 'test_results.lock');

  // Ensure results directory exists
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Clean up any stale lock file left from a previous crashed run
  if (fs.existsSync(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
      console.log('[globalSetup] Removed stale lock file from previous run.');
    } catch {
      // Already gone — no action needed
    }
  }

  // Initialize results file with an empty array — done once, before all workers
  fs.writeFileSync(resultsFile, '[]', 'utf-8');
  console.log(`[globalSetup] Initialized results file: ${resultsFile}`);
}
