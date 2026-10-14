import { beforeEach, describe, expect, it } from "vitest";
import type { AuthResult } from "./authenticate.ts";
import {
  createFloorPreviews,
  PREVIEWS_TTL_MS,
  type FloorPreviewsDeps,
} from "./floorPreviews.ts";
import { MemoryFloorStore } from "./floorStore.ts";
import { MemoryLayoutStore } from "./layoutStore.ts";

interface Plan {
  id: string;
  items: unknown[];
}

describe("floor previews", () => {
  let floors: MemoryFloorStore;
  let layouts: MemoryLayoutStore;
  let who: AuthResult | null;
  let now: number;
  let authCalls: number;
  const deps = (): FloorPreviewsDeps => ({
    authenticate: async () => {
      authCalls++;
      return who;
    },
    floors,
    layouts,
    now: () => now,
  });
  let call: ReturnType<typeof createFloorPreviews>;
  const get = (path = "/account/floors/previews", method = "GET") =>
    call({ method, path, token: "t" });
  const plans = async () => (await get())?.body.previews as Plan[];

  beforeEach(async () => {
    floors = new MemoryFloorStore(() => 1);
    layouts = new MemoryLayoutStore(() => 1);
    now = 1000;
    authCalls = 0;
    await floors.create({ id: "hr", name: "People" });
    who = {
      ok: true,
      user: { id: "user_ana", email: null, name: "Ana", isAdmin: false },
    };
    call = createFloorPreviews(deps());
  });

  it("answers nothing for another path", async () => {
    expect(await get("/account/floors")).toBeNull();
  });

  it("gives a plan for every room, including ones the person cannot enter", async () => {
    const reply = await get();
    expect(reply?.status).toBe(200);
    expect((await plans()).map((plan) => plan.id)).toEqual(["office", "hr"]);
  });

  it("uses the published layout of a room and the default for the others", async () => {
    await layouts.publish(
      "hr",
      { furniture: [{ kind: "sofa", x: 0, z: 0, rotation: 0 }], models: [] },
      "user_ana",
    );
    const all = await plans();
    const hr = all.find((plan) => plan.id === "hr");
    const office = all.find((plan) => plan.id === "office");
    expect(hr?.items.length).toBeLessThan(office?.items.length ?? 0);
    expect(hr?.items.length).toBeGreaterThan(0);
  });

  it("carries no secrets: no names of people, no ids of things, no file names", async () => {
    await layouts.publish(
      "hr",
      {
        furniture: [{ kind: "desk", x: 0, z: 0, rotation: 0 }],
        models: [{ model: "payroll-vault.glb", at: [1, 1], footprint: [1, 1] }],
      },
      "user_ana_secret_author",
    );
    const text = JSON.stringify((await get())?.body);
    expect(text).not.toContain("payroll");
    expect(text).not.toContain("secret_author");
    expect(text).not.toContain("Ana");
    expect(text).not.toContain("canEnter");
    expect(text).not.toContain("chair:");
  });

  it("is small", async () => {
    expect(JSON.stringify((await get())?.body).length).toBeLessThan(20_000);
  });

  it("works with sign-in off", async () => {
    who = null;
    expect((await get())?.status).toBe(200);
  });

  it("is for members", async () => {
    who = { ok: false, reason: "missing" };
    expect((await get())?.status).toBe(401);
    who = { ok: false, reason: "not_member" };
    expect((await get())?.status).toBe(403);
    who = { ok: false, reason: "unavailable" };
    expect((await get())?.status).toBe(503);
  });

  it("only answers GET", async () => {
    expect((await get("/account/floors/previews", "POST"))?.status).toBe(405);
  });

  it("keeps the plans for a short while, but still checks who is asking", async () => {
    const before = (await plans()).find((plan) => plan.id === "hr");
    await layouts.publish(
      "hr",
      { furniture: [{ kind: "sofa", x: 0, z: 0, rotation: 0 }], models: [] },
      "u",
    );
    const cached = (await plans()).find((plan) => plan.id === "hr");
    expect(authCalls).toBe(2);
    expect(cached?.items.length).toBe(before?.items.length);
    now += PREVIEWS_TTL_MS + 1;
    const fresh = (await plans()).find((plan) => plan.id === "hr");
    expect(fresh?.items.length).not.toBe(before?.items.length);
  });

  it("says the database cannot be reached rather than guessing", async () => {
    floors.list = async () => {
      throw new Error("down");
    };
    expect((await get())?.status).toBe(503);
  });
});
