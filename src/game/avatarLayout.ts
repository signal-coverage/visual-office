import type * as THREE from "three";

/**
 * Everything that floats above an avatar, in meters from the floor. Kept in one
 * place because it has to fit three limits at once: the head below, the other
 * pieces around it, and the office ceiling (see OFFICE_HEIGHT) above.
 */

/** The top of the hair. The avatar's head is built in avatar.ts. */
export const HEAD_TOP = 1.76;

export const NAME_TAG = { center: 2.05, height: 0.4 };

export const VIDEO_PANEL = { center: 2.58, height: 0.62 };

/**
 * Whether someone's camera is shown to others like a mirror (true) or the way
 * the camera sees it (false).
 *
 * Meeting apps mirror only your own preview and show everybody else unmirrored,
 * so that text held up to the camera stays readable, and so does this app (the
 * preview is mirrored in SelfView). Turn this on only if you want everyone's
 * panel to look like a mirror too. It only applies to cameras: a shared screen
 * must never be mirrored.
 *
 * It was on for a while because a camera that was set up flipped looked reversed;
 * the cause was the camera's own settings, so it is off again.
 */
export const MIRROR_VIDEO_PANELS = false;

/** Flips a texture left to right, using the whole picture (u becomes 1 - u). */
export function mirrorHorizontally<T extends THREE.Texture>(texture: T): T {
  texture.repeat.x = -1;
  texture.offset.x = 1;
  return texture;
}
