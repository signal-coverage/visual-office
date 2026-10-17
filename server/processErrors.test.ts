import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { errorLogLine, installProcessErrorHandlers } from "./processErrors.ts";

function setup() {
  const proc = new EventEmitter();
  const logs: string[] = [];
  const reports: Array<[unknown, Record<string, unknown> | undefined]> = [];
  const shutdowns: Array<[string, number]> = [];
  installProcessErrorHandlers({
    proc,
    log: (line) => logs.push(line),
    report: (error, context) => reports.push([error, context]),
    shutdown: (reason, code) => shutdowns.push([reason, code]),
  });
  return { proc, logs, reports, shutdowns };
}

describe("errorLogLine", () => {
  it("is one line of JSON with the event, the name, the message and the stack", () => {
    const line = errorLogLine("uncaughtException", new TypeError("bad"));
    expect(line).not.toContain("\n");
    expect(JSON.parse(line)).toMatchObject({
      level: "error",
      event: "uncaughtException",
      name: "TypeError",
      message: "bad",
    });
  });

  it("holds no secrets", () => {
    const line = errorLogLine(
      "unhandledRejection",
      new Error("db postgresql://u:hunter2@h/app for ana@acme.com Bearer abc"),
    );
    expect(line).not.toMatch(/hunter2|ana@acme|Bearer abc/);
  });

  it("copes with a reason that is not an error", () => {
    expect(
      JSON.parse(errorLogLine("unhandledRejection", "plain text")).message,
    ).toBe("plain text");
    expect(JSON.parse(errorLogLine("unhandledRejection", { a: 1 })).name).toBe(
      "NonError",
    );
  });
});

describe("installProcessErrorHandlers", () => {
  it("logs, reports and shuts down with code 1 on an uncaught exception", () => {
    const { proc, logs, reports, shutdowns } = setup();
    const error = new Error("boom");
    proc.emit("uncaughtException", error);
    expect(JSON.parse(logs[0]).event).toBe("uncaughtException");
    expect(reports[0][0]).toBe(error);
    expect(shutdowns).toEqual([["uncaughtException", 1]]);
  });

  it("logs and reports an unhandled rejection but keeps running", () => {
    const { proc, logs, reports, shutdowns } = setup();
    proc.emit("unhandledRejection", new Error("late"));
    expect(JSON.parse(logs[0]).event).toBe("unhandledRejection");
    expect(reports).toHaveLength(1);
    expect(shutdowns).toEqual([]);
  });

  it("still shuts down when reporting fails", () => {
    const proc = new EventEmitter();
    const shutdowns: number[] = [];
    installProcessErrorHandlers({
      proc,
      log: () => {},
      report: () => {
        throw new Error("sentry down");
      },
      shutdown: (_reason, code) => shutdowns.push(code),
    });
    proc.emit("uncaughtException", new Error("boom"));
    expect(shutdowns).toEqual([1]);
  });
});
