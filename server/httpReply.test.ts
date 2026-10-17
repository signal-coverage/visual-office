import { describe, expect, it } from "vitest";
import { runGuarded, sendReply } from "./httpReply.ts";

function fakeResponse(headersSent = false) {
  const sent: Array<{ status: number; body: unknown }> = [];
  let status = 200;
  const res = {
    headersSent,
    status(code: number) {
      status = code;
      return res;
    },
    json(body: unknown) {
      sent.push({ status, body });
      res.headersSent = true;
      return res;
    },
  };
  return { res, sent };
}

function spies() {
  const logs: string[] = [];
  const reports: Array<[unknown, Record<string, unknown> | undefined]> = [];
  return {
    logs,
    reports,
    log: (line: string) => logs.push(line),
    report: (error: unknown, context?: Record<string, unknown>) =>
      reports.push([error, context]),
  };
}

describe("sendReply", () => {
  it("sends the reply, or not found when there is none", () => {
    const { res, sent } = fakeResponse();
    const { report } = spies();
    sendReply(res, { status: 201, body: { ok: true } }, "/admin", report);
    const second = fakeResponse();
    sendReply(second.res, null, "/admin", report);
    expect(sent).toEqual([{ status: 201, body: { ok: true } }]);
    expect(second.sent).toEqual([
      { status: 404, body: { error: "Not found." } },
    ]);
  });

  it("reports an answer of 500 or more, with the area and the status only", () => {
    const { res } = fakeResponse();
    const { report, reports } = spies();
    sendReply(res, { status: 503, body: { error: "db" } }, "/admin", report);
    expect(reports).toHaveLength(1);
    expect(reports[0][1]).toEqual({ route: "/admin", status: 503 });
  });

  it("does not report answers that are the caller's doing", () => {
    const { res } = fakeResponse();
    const { report, reports } = spies();
    sendReply(res, { status: 403, body: {} }, "/admin", report);
    sendReply(res, null, "/admin", report);
    expect(reports).toEqual([]);
  });
});

describe("runGuarded", () => {
  it("lets work that succeeds be", async () => {
    const { res, sent } = fakeResponse();
    const { log, report, logs } = spies();
    await runGuarded(res, "/admin", async () => {}, { log, report });
    expect(sent).toEqual([]);
    expect(logs).toEqual([]);
  });

  it("answers 500 with a plain message, logs and reports when the work throws", async () => {
    const { res, sent } = fakeResponse();
    const { log, report, logs, reports } = spies();
    await runGuarded(
      res,
      "/admin",
      async () => {
        throw new Error("boom postgresql://u:pw@h/db");
      },
      { log, report },
    );
    expect(sent).toEqual([
      { status: 500, body: { error: "Something went wrong on the server." } },
    ]);
    expect(JSON.parse(logs[0])).toMatchObject({ event: "http_error" });
    expect(logs[0]).not.toContain("pw@");
    expect(reports[0][1]).toEqual({ route: "/admin", status: 500 });
  });

  it("does not answer twice when a reply was already on its way", async () => {
    const { res, sent } = fakeResponse(true);
    const { log, report, reports } = spies();
    await runGuarded(
      res,
      "/account",
      async () => {
        throw new Error("late");
      },
      { log, report },
    );
    expect(sent).toEqual([]);
    expect(reports).toHaveLength(1);
  });
});
