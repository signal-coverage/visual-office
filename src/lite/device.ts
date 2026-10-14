/** Below this width (px) the 3D office does not fit: there is no room for the view, the menu and the chat. */
export const MIN_OFFICE_WIDTH = 768;

export type LiteReason = "no-webgl" | "touch" | "small" | "requested";
export type ViewOverride = "office" | "lite";

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
}

export type ViewChoice =
  { view: "office"; reason: null } | { view: "lite"; reason: LiteReason };

export const LITE_REASON_TEXT: Readonly<Record<LiteReason, string>> = {
  "no-webgl":
    "This browser cannot draw 3D graphics (WebGL is off or not available), so the office cannot be shown here.",
  touch:
    "The 3D office is walked with a keyboard and a mouse, and this device only has a touch screen.",
  small: "This window is too narrow to walk around the 3D office comfortably.",
  requested: "You asked for the lite view.",
};

/**
 * The 3D office on a computer that can draw it, the lite screen where it cannot
 * or where nobody could walk in it. Without WebGL the office is impossible, so
 * nothing overrides that; anything else can be overridden from the address.
 */
export function chooseView(device: Device): ViewChoice {
  if (!device.webgl) return { view: "lite", reason: "no-webgl" };
  if (device.override === "lite") return { view: "lite", reason: "requested" };
  if (device.override === "office") return { view: "office", reason: null };
  if (device.coarsePointer && !device.hasMouse)
    return { view: "lite", reason: "touch" };
  if (device.width < MIN_OFFICE_WIDTH) return { view: "lite", reason: "small" };
  return { view: "office", reason: null };
}

/** `?view=lite` or `?view=office` in the address. */
export function viewOverride(search: string): ViewOverride | null {
  const value = new URLSearchParams(search).get("view");
  return value === "lite" || value === "office" ? value : null;
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
  };
}
