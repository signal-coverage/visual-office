/**
 * The avatar's measurements, in meters from the floor, and what sits on its
 * head. Kept in one place because the pieces have to fit each other and the
 * office ceiling (see OFFICE_HEIGHT).
 */

export const LEG = { width: 0.17, height: 0.8, depth: 0.2, hipX: 0.11 };
export const TORSO = { width: 0.46, height: 0.62, depth: 0.26 };
export const HEAD_RADIUS = 0.15;

/** The middle of the head. */
export const HEAD_CENTER = LEG.height + TORSO.height + HEAD_RADIUS + 0.02;

/** The top of the hair. */
export const HEAD_TOP = 1.76;

export const NAME_TAG = { center: 2.05, height: 0.4 };

/**
 * Somebody's camera takes the place of their face: the head becomes a square
 * screen of this size (and thickness), with the hair resting on top of it.
 */
export const VIDEO_FACE = { size: 0.32, depth: 0.14 };

/**
 * The hair is a flat cap. `overlap` is how far it sinks into the round head.
 * Long hair adds a slab (`back`) hanging behind the head.
 */
export const HAIR = {
  height: 0.09,
  overlap: 0.03,
  back: { width: 0.3, height: 0.36, depth: 0.06 },
};

/** Where the slab of long hair sits behind the head (z grows toward the back). */
export function hairBackZ(onScreen: boolean): number {
  const headBack = onScreen ? VIDEO_FACE.depth / 2 : HEAD_RADIUS;
  return headBack + HAIR.back.depth / 2 - 0.01;
}

/**
 * The height of the middle of the hair. On the round head it sinks in a little;
 * on the camera screen it sits above it, so it never covers the picture.
 */
export function hairCenter(onScreen: boolean): number {
  return onScreen
    ? HEAD_CENTER + VIDEO_FACE.size / 2 + HAIR.height / 2
    : HEAD_CENTER + HEAD_RADIUS - HAIR.overlap;
}

/**
 * How to show a camera picture of the given proportions (width / height) on a
 * square: the part in the middle, so the face is not squashed. `mirror` flips
 * it left to right using the same square.
 */
export function faceCrop(
  aspect: number,
  mirror: boolean,
): { repeat: [number, number]; offset: [number, number] } {
  const usable = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const repeatX = usable > 1 ? 1 / usable : 1;
  const repeatY = usable < 1 ? usable : 1;
  const offsetX = (1 - repeatX) / 2;
  const offsetY = (1 - repeatY) / 2;
  return mirror
    ? { repeat: [-repeatX, repeatY], offset: [offsetX + repeatX, offsetY] }
    : { repeat: [repeatX, repeatY], offset: [offsetX, offsetY] };
}

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
