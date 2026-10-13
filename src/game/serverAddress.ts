import { resolveServerUrl } from "./serverUrl";

/** Where the game server is, for the page that is open: what the build was told, or this machine in development. */
export function currentServerUrl(): string {
  return resolveServerUrl({
    configured: import.meta.env.VITE_SERVER_URL,
    dev: import.meta.env.DEV,
    hostname: window.location.hostname,
  });
}
