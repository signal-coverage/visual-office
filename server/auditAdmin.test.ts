import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "./actor.ts";
import {
  DEFAULT_AUDIT_LIMIT,
  handleAuditAdmin,
  MAX_AUDIT_LIMIT,
} from "./auditAdmin.ts";
import { MemoryAuditStore, type AuditStore } from "./auditStore.ts";

const person = (roles: { admin?: boolean; headOf?: string[] }): Actor => ({
  kind: "user",
  user: { id: "user_x", email: null, name: "X", isAdmin: !!roles.admin },
  roles: { admin: roles.admin ?? false, headOf: roles.headOf ?? [] },
});
const admin = person({ admin: true });
const head = person({ headOf: ["office"] });
const member = person({});
const machine: Actor = { kind: "machine" };

describe("handleAuditAdmin", () => {
  let audit: AuditStore;
  const call = (
    actor: Actor | undefined,
    query: Record<string, string> = {},
    method = "GET",
    path = "/admin/audit",
  ) => handleAuditAdmin({ method, path, actor, query }, { audit });
  const fill = async (count: number) => {
    for (let i = 1; i <= count; i++)
      await audit.append({
        actorUserId: "user_a",
        actorName: "A",
        action: "floor.lock",
        detail: { i },
      });
  };

  beforeEach(() => {
    let now = 0;
    audit = new MemoryAuditStore(() => ++now);
  });

  it("answers nothing for paths that are not about the audit log", async () => {
    expect(await call(admin, {}, "GET", "/admin/people")).toBeNull();
    expect(await call(admin, {}, "GET", "/admin/audit/x")).toBeNull();
  });

  it("refuses somebody who is not signed in", async () => {
    expect((await call(undefined))?.status).toBe(401);
  });

  it("refuses members and heads of floors: only admins read it", async () => {
    expect((await call(member))?.status).toBe(403);
    expect((await call(head))?.status).toBe(403);
    expect((await call(head))?.body).toEqual({
      error: "Only admins may read the activity log.",
    });
  });

  it("lets admins and the server's own tools read it", async () => {
    await fill(1);
    for (const actor of [admin, machine]) {
      const reply = await call(actor);
      expect(reply?.status).toBe(200);
      expect((reply?.body.entries as unknown[]).length).toBe(1);
    }
  });

  it("answers the newest first", async () => {
    await fill(3);
    const reply = await call(admin);
    const entries = reply?.body.entries as Array<{ detail: { i: number } }>;
    expect(entries.map((e) => e.detail.i)).toEqual([3, 2, 1]);
    expect(reply?.body.nextBefore).toBeNull();
  });

  it("pages with a cursor, and says when there is no more", async () => {
    await fill(5);
    const first = await call(admin, { limit: "2" });
    expect((first?.body.entries as unknown[]).length).toBe(2);
    expect(first?.body.nextBefore).toEqual(expect.any(Number));
    const second = await call(admin, {
      limit: "2",
      before: String(first?.body.nextBefore),
    });
    const third = await call(admin, {
      limit: "2",
      before: String(second?.body.nextBefore),
    });
    expect(
      (third?.body.entries as Array<{ detail: { i: number } }>).map(
        (e) => e.detail.i,
      ),
    ).toEqual([1]);
    expect(third?.body.nextBefore).toBeNull();
  });

  it("does not offer more when the last page is exactly full", async () => {
    await fill(2);
    expect((await call(admin, { limit: "2" }))?.body.nextBefore).toBeNull();
  });

  it("bounds the limit", async () => {
    await fill(DEFAULT_AUDIT_LIMIT + 5);
    expect(((await call(admin))?.body.entries as unknown[]).length).toBe(
      DEFAULT_AUDIT_LIMIT,
    );
    await fill(MAX_AUDIT_LIMIT);
    expect(
      ((await call(admin, { limit: "100000" }))?.body.entries as unknown[])
        .length,
    ).toBe(MAX_AUDIT_LIMIT);
  });

  it("refuses a limit or a cursor that is not a positive whole number", async () => {
    for (const query of [
      { limit: "0" },
      { limit: "-1" },
      { limit: "abc" },
      { limit: "1.5" },
      { before: "0" },
      { before: "x" },
      { before: "-3" },
    ] as Array<Record<string, string>>) {
      expect((await call(admin, query))?.status, JSON.stringify(query)).toBe(
        400,
      );
    }
  });

  it("only answers GET", async () => {
    expect((await call(admin, {}, "POST"))?.status).toBe(405);
  });

  it("says so when the database cannot be reached", async () => {
    const broken: AuditStore = {
      append: () => Promise.reject(new Error("down")),
      list: () => Promise.reject(new Error("down")),
    };
    const reply = await handleAuditAdmin(
      { method: "GET", path: "/admin/audit", actor: admin, query: {} },
      { audit: broken },
    );
    expect(reply?.status).toBe(503);
  });
});
