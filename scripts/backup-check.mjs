// Checks a backup file made by `npm run backup`: its format, version, sections and checksum.
//
//   npm run backup:check -- --file backup.json
//
// It only reads the file and prints a summary. There is no restore command on
// purpose (see docs/BUILDING.md, Operations). Exit codes: 0 valid, 1 invalid,
// 2 wrong usage.
import { readFileSync } from "node:fs";
import { describeBackup, parseBackup } from "./lib/backup.ts";

const args = process.argv.slice(2);
const at = args.indexOf("--file");
const file = at >= 0 ? args[at + 1] : undefined;

if (!file) {
  console.error("Usage: npm run backup:check -- --file <backup file>");
  process.exit(2);
}

let text;
try {
  text = readFileSync(file, "utf8");
} catch (error) {
  console.error(`Could not read ${file} (${error.code ?? "error"}).`);
  process.exit(2);
}

const result = parseBackup(text);
if (!result.ok) {
  console.error(`✖ ${file} is not a valid backup:`);
  for (const error of result.errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`✔ ${file} is a valid backup.`);
console.log(describeBackup(result.summary));
