import { describe, expect, it } from "vitest";
import { e2eRequested, installE2eHook, type E2eAccess } from "./e2eHook";

const access: E2eAccess = {
  pose: () => ({ x: 1, z: 2, yaw: 3, pitch: 4 }),
  place: () => {},
  seated: () => false,
  renderInfo: () => ({ calls: 5, triangles: 6 }),
  remotePlayers: new Map(),
};

describe("e2eRequested", () => {
  it("is true only when the address carries e2e", () => {
    expect(e2eRequested("?name=Ana&e2e")).toBe(true);
    expect(e2eRequested("?e2e=1")).toBe(true);
    expect(e2eRequested("?name=Ana")).toBe(false);
    expect(e2eRequested("")).toBe(false);
  });
});

describe("installE2eHook", () => {
  it("installs nothing without the e2e flag", () => {
    const target = {} as Window;
    expect(installE2eHook("?name=Ana", access, target)).toBeNull();
    expect(target.__e2e).toBeUndefined();
  });

  it("installs the helper with the flag and takes it away again", () => {
    const target = {} as Window;
    const remove = installE2eHook("?e2e", access, target);
    expect(target.__e2e?.position()).toEqual({ x: 1, z: 2, yaw: 3, pitch: 4 });
    expect(target.__e2e?.stats()).toEqual({
      drawCalls: 5,
      triangles: 6,
      seated: false,
      players: [],
    });
    remove?.();
    expect(target.__e2e).toBeUndefined();
  });

  it("does not take away the helper of a newer game", () => {
    const target = {} as Window;
    const removeFirst = installE2eHook("?e2e", access, target);
    const second = installE2eHook("?e2e", access, target);
    removeFirst?.();
    expect(target.__e2e).toBeDefined();
    second?.();
    expect(target.__e2e).toBeUndefined();
  });
});
