/** The part of `window.visualViewport` the keyboard inset uses. */
export interface VisibleViewport {
  height: number;
  offsetTop: number;
}

/** Shrinking of the visible page by less than this (px) is a browser toolbar sliding, not a keyboard. */
const KEYBOARD_MIN_HEIGHT = 120;

/**
 * How many pixels of the bottom of the window a virtual keyboard covers. The
 * page behind it does not shrink on phones (it is what the keyboard slides
 * over), so anything fixed to the bottom has to be lifted by this much to stay
 * in view.
 */
export function keyboardInset(
  windowHeight: number,
  visible: VisibleViewport | null,
): number {
  if (!visible) return 0;
  const covered = windowHeight - visible.height - visible.offsetTop;
  return covered >= KEYBOARD_MIN_HEIGHT ? covered : 0;
}
