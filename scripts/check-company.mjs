// Looks over one company's settings before deploying it. See docs/COMPANIES.md.
//
//   npm run check:company -- --server .env.acme.server --site .env.acme.site
//
// Each file holds NAME=value lines: the server's variables (the ones for
// Railway) and the site's (the ones for Vercel). Keep them out of git: they
// hold secrets. It prints which setting is wrong, never what it holds.
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { checkCompany } from "../server/companyCheck.ts";

const args = process.argv.slice(2);
const after = (flag) => {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
};
const serverFile = after("--server");
const siteFile = after("--site");

if (!serverFile || !siteFile) {
  console.error(
    "Usage: npm run check:company -- --server <file> --site <file>\n" +
      "  --server  the variables for the game server (Railway)\n" +
      "  --site    the variables for the site (Vercel)",
  );
  process.exit(2);
}

const read = (file) => {
  try {
    return parseEnv(readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`Could not read ${file}: ${error.message}`);
    process.exit(2);
  }
};

const findings = checkCompany(read(serverFile), read(siteFile));
for (const { level, message } of findings)
  console.log(`${level === "error" ? "✖ error  " : "⚠ warning"}  ${message}`);

const errors = findings.filter((f) => f.level === "error").length;
const warnings = findings.length - errors;
console.log(
  findings.length === 0
    ? "✔ Nothing wrong found."
    : `\n${errors} error(s), ${warnings} warning(s).`,
);
process.exit(errors > 0 ? 1 : 0);
