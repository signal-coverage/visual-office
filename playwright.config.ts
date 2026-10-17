import { defineConfig, devices } from "@playwright/test";
import {
  BROWSER_ARGS,
  SERVER_HTTP,
  STACK_ENV,
  WEB_PORT,
  WEB_URL,
} from "./e2e/env.ts";

const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: ci ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: ci
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: WEB_URL,
    trace: "on-first-retry",
    viewport: { width: 800, height: 560 },
    launchOptions: {
      args: BROWSER_ARGS,
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 800, height: 560 },
      },
    },
  ],
  webServer: [
    {
      command: "node e2e/serve.ts",
      url: `${SERVER_HTTP}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: STACK_ENV,
      stdout: "pipe",
    },
    {
      command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: STACK_ENV,
    },
  ],
});
