import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZoneSwitcher } from "./zoneSwitcher.ts";

describe("ZoneSwitcher", () => {
  const GAP = 1000;
  let calls: (string | null)[];
  let switcher: ZoneSwitcher;

  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    switcher = new ZoneSwitcher((zone) => calls.push(zone), GAP);
  });

  afterEach(() => {
    switcher.dispose();
    vi.useRealTimers();
  });

  it("does nothing while the player stays in the open office", () => {
    switcher.update(null);
    switcher.update(null);
    expect(calls).toEqual([]);
  });

  it("switches right away on the first change", () => {
    switcher.update("meeting");
    expect(calls).toEqual(["meeting"]);
  });

  it("does not repeat itself while the zone stays the same", () => {
    switcher.update("meeting");
    switcher.update("meeting");
    vi.advanceTimersByTime(5 * GAP);
    expect(calls).toEqual(["meeting"]);
  });

  it("holds a quick change back, then applies it once the gap has passed", () => {
    switcher.update("meeting");
    vi.advanceTimersByTime(300);
    switcher.update(null);
    expect(calls).toEqual(["meeting"]);

    vi.advanceTimersByTime(GAP - 300 - 1);
    expect(calls).toEqual(["meeting"]);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(["meeting", null]);
  });

  it("applies only the latest zone after a burst of changes", () => {
    switcher.update("meeting");
    vi.advanceTimersByTime(100);
    switcher.update(null);
    vi.advanceTimersByTime(100);
    switcher.update("meeting");
    vi.advanceTimersByTime(100);
    switcher.update(null);
    vi.advanceTimersByTime(10 * GAP);
    expect(calls).toEqual(["meeting", null]);
  });

  it("cancels the pending switch when the player comes back to where the call already is", () => {
    switcher.update("meeting");
    vi.advanceTimersByTime(200);
    switcher.update(null);
    vi.advanceTimersByTime(200);
    switcher.update("meeting");
    vi.advanceTimersByTime(10 * GAP);
    expect(calls).toEqual(["meeting"]);
  });

  it("reports the zone it last sent credentials for, not the one it is waiting to apply", () => {
    expect(switcher.issuedZone).toBeNull();
    switcher.update("meeting");
    expect(switcher.issuedZone).toBe("meeting");
    vi.advanceTimersByTime(100);
    switcher.update(null);
    expect(switcher.issuedZone).toBe("meeting");
    vi.advanceTimersByTime(GAP);
    expect(switcher.issuedZone).toBeNull();
  });

  it("never switches after being disposed", () => {
    switcher.update("meeting");
    vi.advanceTimersByTime(100);
    switcher.update(null);
    switcher.dispose();
    vi.advanceTimersByTime(10 * GAP);
    expect(calls).toEqual(["meeting"]);
  });
});
