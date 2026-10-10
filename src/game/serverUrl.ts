import { SERVER_PORT } from "../../shared/constants.ts";

interface ServerUrlInput {
  /** `VITE_SERVER_URL`, baked in at build time. */
  configured?: string;
  dev: boolean;
  hostname: string;
}

/**
 * Where the game server lives. Guessing is only safe in development: a
 * production site served over https cannot open a plain `ws://` connection, and
 * the server is usually on a different host, so a missing setting must fail loudly.
 */
export function resolveServerUrl({
  configured,
  dev,
  hostname,
}: ServerUrlInput): string {
  const explicit = configured?.trim();
  if (explicit) return explicit;
  if (dev) return `ws://${hostname}:${SERVER_PORT}`;
  throw new Error(
    "VITE_SERVER_URL is not set: point it at the game server (e.g. wss://office.example.com)",
  );
}
