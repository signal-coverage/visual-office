import { describe, expect, it } from "vitest";
import {
  MAX_RESTART_ATTEMPTS,
  restartRetryDelayMs,
  SERVER_RESTARTING_CODE,
  SERVER_RESTARTING_MESSAGE,
} from "./restart.ts";

describe("server restarting", () => {
  it("has its own close code, apart from every other one", () => {
    expect(SERVER_RESTARTING_CODE).toBe(4012);
  });

  it("tells people plainly", () => {
    expect(SERVER_RESTARTING_MESSAGE).toBe(
      "The server is restarting, you will be back in a moment.",
    );
  });
});

describe("restartRetryDelayMs", () => {
  it("waits two seconds at least before the first try", () => {
    expect(restartRetryDelayMs(0, () => 0)).toBe(2000);
  });

  it("adds a random spread, so everybody does not come back at once", () => {
    const early = restartRetryDelayMs(0, () => 0);
    const late = restartRetryDelayMs(0, () => 0.999);
    expect(late! - early!).toBeGreaterThan(2500);
    expect(restartRetryDelayMs(0, () => 0.5)).not.toBe(early);
  });

  it("waits longer on each new attempt, up to a limit", () => {
    const waits = Array.from({ length: MAX_RESTART_ATTEMPTS }, (_, i) =>
      restartRetryDelayMs(i, () => 0),
    );
    expect(waits).toEqual([...waits].sort((a, b) => a! - b!));
    for (const wait of waits) expect(wait!).toBeLessThanOrEqual(15_000);
  });

  it("gives up after the last attempt", () => {
    expect(restartRetryDelayMs(MAX_RESTART_ATTEMPTS - 1)).not.toBeNull();
    expect(restartRetryDelayMs(MAX_RESTART_ATTEMPTS)).toBeNull();
  });
});
