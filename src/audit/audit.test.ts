import { describe, expect, it } from "vitest";
import type { AuditEntry } from "../../shared/audit.ts";
import { fetchAudit, mergeEntries } from "./audit";

const base = "https://office.example.com/admin";
const entry = (
  id: number,
  overrides: Partial<AuditEntry> = {},
): AuditEntry => ({
  id,
  at: 1_000 * id,
  actorUserId: "user_ana",
  actorName: "Ana",
  action: "floor.lock",
  targetUserId: null,
  targetName: null,
  floor: "office",
  detail: {},
  ...overrides,
});

function api(answer: { status?: number; body?: unknown } | Error) {
  const calls: string[] = [];
  const request = async (url: string) => {
    calls.push(url);
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer.body ?? {}), {
      status: answer.status ?? 200,
    });
  };
  return { calls, request };
}

describe("fetchAudit", () => {
  it("brings a page of entries and where the next one starts", async () => {
    const { request, calls } = api({
      body: { entries: [entry(3), entry(2)], nextBefore: 2 },
    });
    expect(await fetchAudit(request, base)).toEqual({
      entries: [entry(3), entry(2)],
      nextBefore: 2,
    });
    expect(calls[0]).toBe(`${base}/audit?limit=50`);
  });

  it("asks for the entries before a cursor", async () => {
    const { request, calls } = api({ body: { entries: [], nextBefore: null } });
    await fetchAudit(request, base, 7);
    expect(calls[0]).toBe(`${base}/audit?limit=50&before=7`);
  });

  it("keeps entries from the server's own tools, with no account", async () => {
    const tool = entry(1, { actorUserId: null, actorName: "Server tools" });
    const { request } = api({ body: { entries: [tool], nextBefore: null } });
    expect((await fetchAudit(request, base))?.entries).toEqual([tool]);
  });

  it("is nothing when the server refuses or does not answer, so the screen can say so", async () => {
    expect(await fetchAudit(api({ status: 403 }).request, base)).toBeNull();
    expect(await fetchAudit(api(new Error("down")).request, base)).toBeNull();
  });

  it("is nothing for an answer that is not what was asked", async () => {
    for (const body of [
      {},
      null,
      { entries: "x", nextBefore: null },
      { entries: [{}], nextBefore: null },
      { entries: [entry(1)], nextBefore: "2" },
      { entries: [{ ...entry(1), detail: [] }], nextBefore: null },
      { entries: [{ ...entry(1), at: "now" }], nextBefore: null },
    ])
      expect(
        await fetchAudit(api({ body }).request, base),
        JSON.stringify(body),
      ).toBeNull();
  });
});

describe("mergeEntries", () => {
  it("puts the older page after what is shown", () => {
    expect(
      mergeEntries([entry(5), entry(4)], [entry(3), entry(2)]).map((e) => e.id),
    ).toEqual([5, 4, 3, 2]);
  });

  it("does not show an entry twice if a page overlaps", () => {
    expect(
      mergeEntries([entry(5), entry(4)], [entry(4), entry(3)]).map((e) => e.id),
    ).toEqual([5, 4, 3]);
  });
});
