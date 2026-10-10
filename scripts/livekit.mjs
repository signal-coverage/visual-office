// Starts a local LiveKit server in dev mode (API key "devkey", secret "secret").
// Looks for a binary in tools/livekit first, then on the PATH.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const binaryName =
  process.platform === "win32" ? "livekit-server.exe" : "livekit-server";
const local = join(root, "tools", "livekit", binaryName);
const command = existsSync(local) ? local : "livekit-server";

const child = spawn(command, ["--dev"], { stdio: "inherit" });

child.on("error", (error) => {
  if (error.code === "ENOENT") {
    console.error(
      "livekit-server not found. Voice chat needs it in development.\n" +
        "Install it (https://docs.livekit.io/home/self-hosting/local/) or drop the binary in tools/livekit/.\n" +
        "The rest of the app keeps working without it.",
    );
    // Exit cleanly so `npm run dev:all` keeps the web and game servers running
    process.exit(0);
  }
  throw error;
});
child.on("exit", (code) => process.exit(code ?? 0));
