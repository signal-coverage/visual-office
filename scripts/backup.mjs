// Backs up the app's own data through the server's admin API. See docs/BUILDING.md (Operations).
//
//   npm run backup -- --server https://office.example.com --token-file token.txt --out backup.json
//
// The token is the server's machine token (FLOOR_ADMIN_TOKEN) or the sign-in
// token of an admin, alone on the first line of the file. It is never printed.
// Exit codes: 0 done, 1 unexpected failure, 2 wrong usage, 3 the server could
// not be reached or did not allow the token, 4 written, but with warnings
// (some part could not be read).
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import {
  BackupError,
  collectBackup,
  describeBackup,
  normalizeServerUrl,
  parseBackup,
  serializeBackup,
  tokenFromFile,
} from "./lib/backup.ts";

const USAGE = `Usage: npm run backup -- --server <url> --token-file <file> --out <file> [options]
  --server <url>      the game server (https://..., or the wss:// address of the game)
  --token-file <file> a file with the token alone on its first line
  --out <file>        where to write the backup (one JSON file)
  --include-secrets   keep the secret calendar feed addresses (left out by default)
  --all-versions      keep every layout version, not only the current one
  --force             replace --out if it already exists`;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

async function main() {
  if (flag("--help") || flag("-h")) {
    console.log(USAGE);
    return 0;
  }
  const serverArg = value("--server");
  const tokenFile = value("--token-file");
  const out = value("--out");
  if (!serverArg || !tokenFile || !out) {
    console.error(USAGE);
    return 2;
  }
  if (existsSync(out) && !flag("--force"))
    throw new BackupError(
      `${out} already exists. Choose another file, or add --force to replace it.`,
      2,
    );

  const origin = normalizeServerUrl(serverArg);
  let tokenText;
  try {
    tokenText = readFileSync(tokenFile, "utf8");
  } catch (error) {
    throw new BackupError(
      `Could not read the token file (${error.code ?? "error"}).`,
      2,
    );
  }
  const token = tokenFromFile(tokenText);

  const http = {
    async get(path) {
      const response = await fetch(`${origin}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30_000),
      });
      const retry = Number(response.headers.get("retry-after"));
      return {
        status: response.status,
        body: await response.json().catch(() => null),
        ...(Number.isFinite(retry) && retry > 0
          ? { retryAfterSeconds: retry }
          : {}),
      };
    },
  };

  console.log("Reading the data from the server...");
  const { file, warnings } = await collectBackup(http, {
    includeSecrets: flag("--include-secrets"),
    allVersions: flag("--all-versions"),
    now: Date.now,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });

  const text = serializeBackup(file);
  const check = parseBackup(text);
  if (!check.ok)
    throw new BackupError(
      `The backup did not pass its own check (${check.errors.join(" ")}). Nothing was written.`,
      1,
    );
  const temporary = `${out}.partial`;
  writeFileSync(temporary, text, { mode: 0o600 });
  renameSync(temporary, out);

  console.log(describeBackup(check.summary));
  console.log(`Written to ${out}`);
  if (file.options.includeSecrets)
    console.log(
      "This file holds the secret calendar feed addresses: keep it as private as a password.",
    );
  return warnings.length > 0 ? 4 : 0;
}

// Set the code and let the process end by itself: exiting while a connection is closing crashes Node on Windows
try {
  process.exitCode = await main();
} catch (error) {
  if (error instanceof BackupError) {
    console.error(`Error: ${error.message}`);
    process.exitCode = error.exitCode;
  } else {
    console.error(
      `Unexpected error: ${error instanceof Error ? error.message : "unknown"}`,
    );
    process.exitCode = 1;
  }
}
