export const CLOSE_KEYS = ["F", "Esc"] as const;
/** What closes an interactive panel, as the keyboard names them (the game only sees keys while the mouse is captured). */
export const CLOSE_CODES: readonly string[] = ["KeyF", "Escape"];
export const CLOSE_LABEL = "Close";
export const TOUCH_CLOSE_HINT = "Tap the scene or push the joystick to close";
