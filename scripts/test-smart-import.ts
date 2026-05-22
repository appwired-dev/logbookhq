/**
 * Test the smart fallback parser against a real-world xlsx logbook file.
 * Usage:
 *   npx tsx scripts/test-smart-import.ts "/path/to/file.xlsx"
 *
 * Prints how the parser detected the file's format, how many flights were
 * extracted, and a sample of the first/last few parsed rows.
 */
import * as XLSX from "xlsx";
import { parseAnyLogbook } from "../lib/import-formats";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: tsx scripts/test-smart-import.ts <file>");
  process.exit(1);
}

function fileToCsv(p: string): string {
  if (/\.(csv|tsv|txt)$/i.test(p)) {
    const fs = require("fs");
    return fs.readFileSync(p, "utf-8");
  }
  const wb = XLSX.readFile(p);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_csv(sheet, { blankrows: true });
}

const csv = fileToCsv(filePath);
console.log(`CSV size: ${csv.length} bytes, ${csv.split("\n").length} lines`);
console.log("");

try {
  const result = parseAnyLogbook(csv);
  console.log(`Detected format: ${result.format}`);
  console.log(`Flights parsed: ${result.flights.length}`);
  console.log("");

  if (result.flights.length > 0) {
    console.log("=== First 3 flights ===");
    for (const f of result.flights.slice(0, 3)) {
      console.log(JSON.stringify({
        date: f.date,
        make_model: f.make_model,
        registration: f.registration,
        category: f.category,
        role: f.role,
        day_time: f.day_time,
        night_time: f.night_time,
        route: f.route,
        is_xcountry: f.is_xcountry,
      }));
    }
    console.log("");
    console.log("=== Last 3 flights ===");
    for (const f of result.flights.slice(-3)) {
      console.log(JSON.stringify({
        date: f.date,
        make_model: f.make_model,
        registration: f.registration,
        category: f.category,
        role: f.role,
        day_time: f.day_time,
        night_time: f.night_time,
        route: f.route,
      }));
    }
    console.log("");
    console.log("=== Summary ===");
    const totalHours = result.flights.reduce((s, f) => s + f.day_time + f.night_time, 0);
    console.log(`Total hours: ${totalHours.toFixed(1)}`);
    const byCat: Record<string, number> = {};
    for (const f of result.flights) byCat[f.category] = (byCat[f.category] ?? 0) + 1;
    console.log(`By category: ${JSON.stringify(byCat)}`);
    const byRole: Record<string, number> = {};
    for (const f of result.flights) byRole[f.role] = (byRole[f.role] ?? 0) + 1;
    console.log(`By role: ${JSON.stringify(byRole)}`);
  }
} catch (e) {
  console.error(`Parser threw: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
