import fs from "fs";
import { parse } from "csv-parse/sync";

// 1️⃣ Parse CSV file to JS objects
export function parseCsv(filePath: string) {
  const fileContent = fs.readFileSync(filePath, "utf-8");

  const records = parse(fileContent, {
    columns: true, // first row as keys
    skip_empty_lines: true
  });

  return records; // Array of objects
}

// 2️⃣ Calculate expected Eligibility Summary from CSV
export function calculateEligibilitySummary(records: any[]) {
  const eligibility: Record<string, number> = {};

  records.forEach(record => {
    const status = record["Status"]?.trim();
    if (status) {
      eligibility[status] = (eligibility[status] || 0) + 1;
    }
  });

  return eligibility; // e.g. { "Enrolled": 3 }
}


// csv-to-json.ts
export function validateEligibilitySummary(
  eligibilitySummary: Record<string, string>,
  csvRecords: any[],
  expectFn: typeof import('@playwright/test').expect
) {
  if (Object.keys(eligibilitySummary).length === 0) {
    console.log("⚠️ No Eligibility Summary available; skipping validation");
    return;
  }

  const csvEligibility: Record<string, number> = {};
  csvRecords.forEach(r => {
    const status = r["Status"]?.trim();
    if (status) csvEligibility[status] = (csvEligibility[status] || 0) + 1;
  });

  for (const [status, count] of Object.entries(eligibilitySummary)) {
    const expectedCount = csvEligibility[status] || 0;
    expectFn(count).toBe(expectedCount.toString());
    console.log(`✅ Status '${status}' validated: ${count} matches CSV count ${expectedCount}`);
  }
}

