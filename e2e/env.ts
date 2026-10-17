export const SERVER_PORT = 2570;
export const WEB_PORT = 5175;
export const ADMIN_TOKEN = "e2e-throwaway-admin-token";
export const SERVER_HTTP = `http://127.0.0.1:${SERVER_PORT}`;
export const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

/**
 * What the game server and the dev server start with. Every variable that could
 * point at a real service is present and empty: an empty value counts as set,
 * so neither server lets a `.env.local` fill it in. No database is ever used.
 */
export const STACK_ENV: Record<string, string> = {
  NODE_ENV: "development",
  PORT: String(SERVER_PORT),
  DATABASE_URL: "",
  CLERK_SECRET_KEY: "",
  VITE_CLERK_PUBLISHABLE_KEY: "",
  CLERK_ORGANIZATION_ID: "",
  ADMIN_EMAILS: "",
  SENTRY_DSN: "",
  VITE_SENTRY_DSN: "",
  // Not empty: outside production an empty LiveKit setting falls back to the development
  // server at ws://localhost:7880, which may be the one somebody is using. This address has
  // nothing listening, so voice is offered (the server hands out tokens) but never connects.
  LIVEKIT_URL: "ws://127.0.0.1:9",
  LIVEKIT_API_KEY: "e2e-no-livekit-key",
  LIVEKIT_API_SECRET: "e2e-no-livekit-secret-0123456789abcdef",
  ALLOWED_ORIGINS: "",
  CALENDAR_ALLOW_LOCAL_FOR_TESTS: "",
  FLOOR_ADMIN_TOKEN: ADMIN_TOKEN,
  GAME_SERVER_URL: SERVER_HTTP,
  VITE_SERVER_URL: `ws://127.0.0.1:${SERVER_PORT}`,
};

/**
 * Headless Chromium draws WebGL in software through the first two, and has a
 * microphone and a camera (a beep and a test picture) that it allows without
 * asking through the other two: nothing of the machine's own is ever used.
 */
export const BROWSER_ARGS = [
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
];
