/** Below this width (px) the 3D office does not fit: there is no room for the view, the menu and the chat. */
export const MIN_OFFICE_WIDTH = 768;

export type LiteReason = "no-webgl" | "small" | "requested";
export type ViewOverride = "office" | "lite";
/** What the person walks the office with: the keyboard and the mouse, or fingers on the screen. */
export type ControlsMode = "mouse" | "touch";

/** What decides how the office is shown, read from the browser. */
export interface Device {
  /** The browser can draw 3D graphics. */
  webgl: boolean;
  /** The main pointer is a finger (a phone or a tablet). */
  coarsePointer: boolean;
  /** Some pointer can hover and be precise (a mouse or a trackpad): there is something to look around with. */
  hasMouse: boolean;
  /** Width of the window in pixels. */
  width: number;
  /** What the address asked for, if anything. */
  override: ViewOverride | null;
  /** The controls the address asked for, if anything. */
  controls: ControlsMode | null;
}

export type ViewChoice =
  { view: "office"; reason: null } | { view: "lite"; reason: LiteReason };

export const LITE_REASON_TEXT: Readonly<Record<LiteReason, string>> = {
  "no-webgl":
    "This browser cannot draw 3D graphics (WebGL is off or not available), so the office cannot be shown here.",
  small: "This window is too narrow to walk around the 3D office comfortably.",
  requested: "You asked for the lite view.",
};

/** Whether the only way to point is a finger (a phone or a tablet): the office is walked with the touch controls then. */
function touchOnly(device: Device): boolean {
  return device.coarsePointer && !device.hasMouse;
}

/**
 * The 3D office wherever the device can draw it: on a computer, and on a phone
 * or tablet too, which walks it with the touch controls. The lite screen is for
 * a device without WebGL and for a narrow window with a mouse, where there is
 * no room for the view, the menu and the chat. Without WebGL the office is
 * impossible, so nothing overrides that; anything else can be overridden from
 * the address.
 */
export function chooseView(device: Device): ViewChoice {
  if (!device.webgl) return { view: "lite", reason: "no-webgl" };
  if (device.override === "lite") return { view: "lite", reason: "requested" };
  if (device.override === "office") return { view: "office", reason: null };
  if (touchOnly(device)) return { view: "office", reason: null };
  if (device.width < MIN_OFFICE_WIDTH) return { view: "lite", reason: "small" };
  return { view: "office", reason: null };
}

/** The touch controls where the only pointer is a finger, the keyboard and the mouse otherwise, unless the address asks for one. */
export function chooseControls(device: Device): ControlsMode {
  if (device.controls) return device.controls;
  return touchOnly(device) ? "touch" : "mouse";
}

/** `?controls=touch` or `?controls=mouse` in the address. */
export function controlsOverride(search: string): ControlsMode | null {
  const value = new URLSearchParams(search).get("controls");
  return value === "touch" || value === "mouse" ? value : null;
}

/** `?view=lite` or `?view=office` in the address. */
export function viewOverride(search: string): ViewOverride | null {
  const value = new URLSearchParams(search).get("view");
  return value === "lite" || value === "office" ? value : null;
}

/** The same address asking for one view or the other. */
export function withView(href: string, view: ViewOverride): string {
  const url = new URL(href);
  url.searchParams.set("view", view);
  return url.toString();
}

/** Whether a graphics context can be made, on a throw-away canvas. */
export function hasWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function readDevice(): Device {
  const matches = (query: string) =>
    typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  return {
    webgl: hasWebgl(),
    coarsePointer: matches("(pointer: coarse)"),
    hasMouse: matches("(any-pointer: fine)") && matches("(any-hover: hover)"),
    width: window.innerWidth,
    override: viewOverride(window.location.search),
    controls: controlsOverride(window.location.search),
  };
}
