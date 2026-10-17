import { chromium } from "@playwright/test";
import { BROWSER_ARGS, WEB_URL } from "./env";

/**
 * The dev server optimizes its dependencies the first time a page asks for
 * them, and reloads that page when it does. One visit before the specs gets
 * that out of the way, so no spec has to survive it.
 */
export default async function globalSetup() {
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  try {
    const page = await browser.newPage();
    await page.goto(`${WEB_URL}/?name=Warmup&e2e`);
    await page
      .getByRole("button", { name: "Menu (Esc)" })
      .waitFor({ timeout: 90_000 });
  } finally {
    await browser.close();
  }
}
