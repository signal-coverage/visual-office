/**
 * Whether the keys the game thinks are held must be forgotten when the browser
 * announces a change of the mouse capture. They must, whenever the capture was
 * lost or gained (keys released while the mouse was free never reach the game).
 * They must not when the capture never changed: clicking the scene while
 * walking asks for it again and the browser announces it again, and forgetting
 * the keys then stops a player who is still holding them.
 */
export function shouldDropKeys(wasLocked: boolean, isLocked: boolean): boolean {
  return !(wasLocked && isLocked);
}
