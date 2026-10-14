import { describe, expect, it } from "vitest";
import {
  chooseView,
  LITE_REASON_TEXT,
  MIN_OFFICE_WIDTH,
  viewOverride,
  type Device,
} from "./device";

const desktop: Device = {
  webgl: true,
  coarsePointer: false,
  hasMouse: true,
  width: 1440,
  override: null,
};

describe("chooseView", () => {
  it("shows the 3D office on a desktop with graphics", () => {
    expect(chooseView(desktop)).toEqual({ view: "office", reason: null });
  });

  it("shows the lite screen when there is no WebGL", () => {
    expect(chooseView({ ...desktop, webgl: false })).toEqual({
      view: "lite",
      reason: "no-webgl",
    });
  });

  it("shows the lite screen on a phone or tablet: touch only, no mouse", () => {
    expect(
      chooseView({
        ...desktop,
        coarsePointer: true,
        hasMouse: false,
        width: 1024,
      }),
    ).toEqual({ view: "lite", reason: "touch" });
  });

  it("keeps the office on a touch laptop, which also has a mouse or trackpad", () => {
    expect(
      chooseView({ ...desktop, coarsePointer: true, hasMouse: true }).view,
    ).toBe("office");
  });

  it("shows the lite screen on a narrow window", () => {
    expect(chooseView({ ...desktop, width: MIN_OFFICE_WIDTH - 1 })).toEqual({
      view: "lite",
      reason: "small",
    });
    expect(chooseView({ ...desktop, width: MIN_OFFICE_WIDTH }).view).toBe(
      "office",
    );
  });

  it("names the first reason that applies: no WebGL before touch before size", () => {
    expect(
      chooseView({
        webgl: false,
        coarsePointer: true,
        hasMouse: false,
        width: 300,
        override: null,
      }).reason,
    ).toBe("no-webgl");
    expect(
      chooseView({
        ...desktop,
        coarsePointer: true,
        hasMouse: false,
        width: 300,
      }).reason,
    ).toBe("touch");
  });

  it("lets somebody ask for the lite screen on any device", () => {
    expect(chooseView({ ...desktop, override: "lite" })).toEqual({
      view: "lite",
      reason: "requested",
    });
  });

  it("lets somebody ask for the office on a small or touch device that has WebGL", () => {
    expect(
      chooseView({
        ...desktop,
        coarsePointer: true,
        hasMouse: false,
        width: 390,
        override: "office",
      }),
    ).toEqual({ view: "office", reason: null });
  });

  it("cannot show the office without WebGL, whatever was asked", () => {
    expect(
      chooseView({ ...desktop, webgl: false, override: "office" }),
    ).toEqual({ view: "lite", reason: "no-webgl" });
  });
});

describe("viewOverride", () => {
  it("reads ?view= from the address", () => {
    expect(viewOverride("?view=lite")).toBe("lite");
    expect(viewOverride("?view=office")).toBe("office");
    expect(viewOverride("?name=Ana&view=lite")).toBe("lite");
  });

  it("ignores anything else", () => {
    expect(viewOverride("")).toBeNull();
    expect(viewOverride("?view=3d")).toBeNull();
    expect(viewOverride("?view=")).toBeNull();
    expect(viewOverride("?name=Ana")).toBeNull();
  });
});

describe("LITE_REASON_TEXT", () => {
  it("explains every reason in a sentence", () => {
    for (const reason of ["no-webgl", "touch", "small", "requested"] as const)
      expect(LITE_REASON_TEXT[reason].length).toBeGreaterThan(20);
  });
});
