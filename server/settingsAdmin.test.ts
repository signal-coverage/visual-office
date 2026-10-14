import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "./actor.ts";
import {
  createCompanySettings,
  type CompanySettings,
} from "./companySettings.ts";
import type { AuditInput } from "./auditStore.ts";
import { handleSettingsAdmin } from "./settingsAdmin.ts";
import { MemorySettingsStore } from "./settingsStore.ts";

const person = (roles: { admin?: boolean; headOf?: string[] }): Actor => ({
  kind: "user",
  user: { id: "user_x", email: null, name: "X", isAdmin: !!roles.admin },
  roles: { admin: roles.admin ?? false, headOf: roles.headOf ?? [] },
});
const admin = person({ admin: true });
const head = person({ headOf: ["office"] });
const member = person({});
const machine: Actor = { kind: "machine" };

describe("handleSettingsAdmin", () => {
  let settings: CompanySettings;
  const call = (
    actor: Actor | undefined,
    method: string,
    path = "/admin/settings",
    body?: unknown,
  ) => handleSettingsAdmin({ method, path, body, actor }, { settings });

  beforeEach(() => {
    settings = createCompanySettings(new MemorySettingsStore());
  });

  it("answers nothing for paths that are not about settings", async () => {
    expect(await call(admin, "GET", "/admin/people")).toBeNull();
    expect(await call(admin, "GET", "/health")).toBeNull();
    expect(await call(admin, "GET", "/admin/settings/other")).toBeNull();
  });

  it("says people may not choose their name by default", async () => {
    const reply = await call(admin, "GET");
    expect(reply).toEqual({ status: 200, body: { allowNameEdit: false } });
  });

  it("lets an admin turn it on and off", async () => {
    expect(
      await call(admin, "POST", "/admin/settings", { allowNameEdit: true }),
    ).toEqual({ status: 200, body: { allowNameEdit: true } });
    expect(await settings.allowNameEdit()).toBe(true);
    expect((await call(admin, "GET"))?.body).toEqual({ allowNameEdit: true });
    await call(admin, "POST", "/admin/settings", { allowNameEdit: false });
    expect(await settings.allowNameEdit()).toBe(false);
  });

  it("lets the server's own tools do it too", async () => {
    expect((await call(machine, "GET"))?.status).toBe(200);
    expect(
      (await call(machine, "POST", "/admin/settings", { allowNameEdit: true }))
        ?.status,
    ).toBe(200);
  });

  it("refuses heads of floors and members, for reading and for changing", async () => {
    for (const actor of [head, member]) {
      expect((await call(actor, "GET"))?.status).toBe(403);
      expect(
        (await call(actor, "POST", "/admin/settings", { allowNameEdit: true }))
          ?.status,
      ).toBe(403);
    }
    expect(await settings.allowNameEdit()).toBe(false);
  });

  it("refuses somebody nobody knows", async () => {
    expect((await call(undefined, "GET"))?.status).toBe(401);
    expect(
      (
        await call(undefined, "POST", "/admin/settings", {
          allowNameEdit: true,
        })
      )?.status,
    ).toBe(401);
    expect(await settings.allowNameEdit()).toBe(false);
  });

  it("asks for a real true or false", async () => {
    for (const body of [
      undefined,
      null,
      [],
      {},
      { allowNameEdit: "true" },
      { allowNameEdit: 1 },
      { allowNameEdit: null },
    ])
      expect((await call(admin, "POST", "/admin/settings", body))?.status).toBe(
        400,
      );
    expect(await settings.allowNameEdit()).toBe(false);
  });

  it("only answers GET and POST", async () => {
    expect((await call(admin, "DELETE"))?.status).toBe(405);
  });

  it("says so when the database cannot be reached", async () => {
    const broken: CompanySettings = {
      allowNameEdit: async () => {
        throw new Error("down");
      },
      setAllowNameEdit: async () => {
        throw new Error("down");
      },
    };
    const reply = await handleSettingsAdmin(
      { method: "GET", path: "/admin/settings", actor: admin },
      { settings: broken },
    );
    expect(reply?.status).toBe(503);
  });
});

describe("handleSettingsAdmin audit", () => {
  let recorded: AuditInput[];
  const call = (actor: Actor, body: unknown) =>
    handleSettingsAdmin(
      { method: "POST", path: "/admin/settings", body, actor },
      {
        settings: createCompanySettings(new MemorySettingsStore()),
        audit: async (entry) => {
          recorded.push(entry);
        },
      },
    );

  beforeEach(() => {
    recorded = [];
  });

  it("records who changed whether people choose their name", async () => {
    await call(admin, { allowNameEdit: true });
    expect(recorded).toEqual([
      {
        actorUserId: "user_x",
        actorName: "X",
        action: "settings.allow_name_edit",
        detail: { allow: true },
      },
    ]);
  });

  it("records nothing for a refused or invalid request", async () => {
    await call(head, { allowNameEdit: true });
    await call(admin, { allowNameEdit: "yes" });
    expect(recorded).toEqual([]);
  });
});
