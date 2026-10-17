import { test, expect } from "./fixtures";
import { ADMIN_TOKEN, SERVER_HTTP } from "./env";

test.describe("operations", () => {
  test("/health answers to anybody, with no database here, and says nothing about people", async ({
    request,
  }) => {
    const response = await request.get(`${SERVER_HTTP}/health`, {
      headers: { Origin: "https://not-allowed.example.com" },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["db", "ok", "uptime", "version"]);
    expect(body).toMatchObject({ ok: true, db: "none" });
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.version).toBe("string");
    expect(response.headers()["cache-control"]).toBe("no-store");
  });

  test("answers carry the security headers", async ({ request }) => {
    for (const path of ["/health", "/admin/people", "/calendar/rooms"]) {
      const response = await request.get(`${SERVER_HTTP}${path}`);
      expect(response.headers()["x-content-type-options"], path).toBe(
        "nosniff",
      );
      expect(response.headers()["referrer-policy"], path).toBe("no-referrer");
    }
  });

  test("the admin API still works with the machine token, behind the rate limit", async ({
    request,
  }) => {
    const response = await request.get(`${SERVER_HTTP}/admin/floors`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).floors.length).toBeGreaterThan(0);
  });

  test("with no monitoring address nothing of monitoring is downloaded or called", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const urls: string[] = [];
    page.on("request", (request) => urls.push(request.url()));
    await page.goto("/?e2e");
    await expect(page.getByRole("heading", { name: "Lobby" })).toBeVisible();
    await page.waitForTimeout(1500);
    await context.close();
    expect(urls.filter((url) => /sentryClient|sentry\.io/i.test(url))).toEqual(
      [],
    );
  });
});
