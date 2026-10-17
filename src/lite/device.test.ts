import { describe, expect, it } from "vitest";
import {
  chooseControls,
  chooseView,
  controlsOverride,
  LITE_REASON_TEXT,
  MIN_OFFICE_WIDTH,
  viewOverride,
  withView,
  type Device,
} from "./device";

const desktop: Device = {
  webgl: true,
  coarsePointer: false,
  hasMouse: true,
  width: 1440,
  override: null,
  controls: null,
};

const phone: Device = {
  webgl: true,
  coarsePointer: true,
  hasMouse: false,
  width: 393,
  override: null,
  controls: null,
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

  it("shows the 3D office on a phone or tablet with graphics: touch only, no mouse", () => {
    expect(chooseView(phone)).toEqual({ view: "office", reason: null });
    expect(chooseView({ ...phone, width: 1024 })).toEqual({
      view: "office",
      reason: null,
    });
  });

  it("shows the lite screen on a phone without graphics", () => {
    expect(chooseView({ ...phone, webgl: false })).toEqual({
      view: "lite",
      reason: "no-webgl",
    });
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

  it("names the first reason that applies: no WebGL before the size of the window", () => {
    expect(
      chooseView({
        webgl: false,
        coarsePointer: false,
        hasMouse: true,
        width: 300,
        override: null,
        controls: null,
      }).reason,
    ).toBe("no-webgl");
    expect(chooseView({ ...desktop, width: 300 }).reason).toBe("small");
  });

  it("lets somebody ask for the lite screen on any device", () => {
    expect(chooseView({ ...desktop, override: "lite" })).toEqual({
      view: "lite",
      reason: "requested",
    });
    expect(chooseView({ ...phone, override: "lite" })).toEqual({
      view: "lite",
      reason: "requested",
    });
  });

  it("lets somebody ask for the office on a narrow window that has WebGL", () => {
    expect(chooseView({ ...desktop, width: 390, override: "office" })).toEqual({
      view: "office",
      reason: null,
    });
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
    for (const reason of ["no-webgl", "small", "requested"] as const)
      expect(LITE_REASON_TEXT[reason].length).toBeGreaterThan(20);
  });
});

describe("controlsOverride", () => {
  it("reads ?controls= from the address", () => {
    expect(controlsOverride("?controls=touch")).toBe("touch");
    expect(controlsOverride("?name=Ana&controls=mouse")).toBe("mouse");
  });

  it("ignores anything else", () => {
    expect(controlsOverride("")).toBeNull();
    expect(controlsOverride("?controls=gamepad")).toBeNull();
    expect(controlsOverride("?controls=")).toBeNull();
  });
});

describe("chooseControls", () => {
  it("uses the keyboard and the mouse on a computer", () => {
    expect(chooseControls(desktop)).toBe("mouse");
  });

  it("uses the touch controls where the only pointer is a finger", () => {
    expect(chooseControls(phone)).toBe("touch");
    expect(chooseControls({ ...phone, width: 1180 })).toBe("touch");
  });

  it("keeps the mouse on a touch laptop, which also has a mouse or trackpad", () => {
    expect(chooseControls({ ...desktop, coarsePointer: true })).toBe("mouse");
  });

  it("lets somebody ask for either, on any device", () => {
    expect(chooseControls({ ...desktop, controls: "touch" })).toBe("touch");
    expect(chooseControls({ ...phone, controls: "mouse" })).toBe("mouse");
  });
});

describe("withView", () => {
  it("asks for a view in the same address, keeping everything else", () => {
    expect(withView("https://x.test/?name=Ana&floor=lab", "lite")).toBe(
      "https://x.test/?name=Ana&floor=lab&view=lite",
    );
    expect(withView("https://x.test/", "office")).toBe(
      "https://x.test/?view=office",
    );
  });

  it("replaces the view that was asked for before", () => {
    expect(withView("https://x.test/?view=lite&name=Ana", "office")).toBe(
      "https://x.test/?view=office&name=Ana",
    );
  });

  it("keeps the fragment", () => {
    expect(withView("https://x.test/?a=1#top", "lite")).toBe(
      "https://x.test/?a=1&view=lite#top",
    );
  });
});
