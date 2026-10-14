/**
 * The avatar's measurements, in meters from the floor, and what sits on its
 * head. Kept in one place because the pieces have to fit each other and the
 * office ceiling (see OFFICE_HEIGHT).
 */

/*
 * The body is the prototype's: a blocky person 1.95 m tall. Every piece is a
 * box; a leg or an arm swings around its top edge (the hip, the shoulder).
 */
export const LEG = { width: 0.2, height: 0.84, depth: 0.22, hipX: 0.13 };
export const TORSO = { width: 0.52, height: 0.6, depth: 0.28 };
/** The middle of the torso: its bottom edge tucks 2 cm into the legs. */
export const TORSO_CENTER = 1.12;
/** The sleeve; the hand hangs from its end. */
export const ARM = { width: 0.15, height: 0.5, depth: 0.18, shoulderX: 0.34 };
export const HAND = { width: 0.13, height: 0.2, depth: 0.15 };
/** Where the arm hangs from: just below the top of the torso. */
export const SHOULDER_Y = 1.4;
export const HEAD = { width: 0.4, height: 0.42, depth: 0.38 };

/** The middle of the head. */
export const HEAD_CENTER = 1.66;

/** The top of the hair. */
export const HEAD_TOP = 1.95;
/** The whole avatar, standing. */
export const AVATAR_HEIGHT = HEAD_TOP;

/** Two small dark squares on the front of the head. */
export const EYES = { xs: [-0.09, 0.09], size: 0.06, dy: 0.04, depth: 0.01 };

export const NAME_TAG = { center: 2.25, height: 0.4 };

/**
 * Somebody's camera takes the place of their face: the head becomes a square
 * screen as wide and deep as the head, with the hair resting on top of it.
 */
export const VIDEO_FACE = { size: 0.4, depth: HEAD.depth };

/**
 * The hair is a flat cap that hugs the head and stands 1 cm out of it on the
 * sides and over the forehead. It must not be level with the face: two faces
 * in the same plane flicker over each other depending on the view.
 * `overlap` is how far it sinks into the head. Long hair adds a slab (`back`)
 * hanging behind the head.
 */
export const HAIR = {
  width: 0.42,
  height: 0.1,
  depth: 0.42,
  overlap: 0.03,
  /** How far the cap is pushed to the back of the head. */
  backShift: 0.01,
  back: { width: 0.42, height: 0.55, depth: 0.06, dy: -0.06 },
};

/**
 * Where the slab of long hair sits behind the head (z grows toward the back):
 * its back face is level with the back of the cap, so the two make one surface.
 * The cap does not change with the camera, and neither does this.
 */
export function hairBackZ(): number {
  return HAIR.backShift + HAIR.depth / 2 - HAIR.back.depth / 2;
}

/**
 * The height of the middle of the hair. On the box head it sinks in a little;
 * on the camera screen it sits above it, so it never covers the picture.
 */
export function hairCenter(onScreen: boolean): number {
  return onScreen
    ? HEAD_CENTER + VIDEO_FACE.size / 2 + HAIR.height / 2
    : HEAD_CENTER + HEAD.height / 2 + HAIR.height / 2 - HAIR.overlap;
}

/**
 * How far the hair and whatever is worn over it rise when a camera screen
 * replaces the head: the screen is a little shorter than the head but the cap
 * must not cover its top edge.
 */
export const GEAR_LIFT_ON_SCREEN = hairCenter(true) - hairCenter(false);

/**
 * The highest anything worn on the head may reach, so that even lifted by the
 * camera it stays under the name tag.
 */
export const GEAR_TOP_LIMIT =
  NAME_TAG.center - NAME_TAG.height / 2 - GEAR_LIFT_ON_SCREEN;

/**
 * A shoe: a box a little wider than the leg that reaches forward (-z, where the
 * avatar looks). `dz` is how far its middle is in front of the leg's.
 */
export const SHOE = { width: 0.22, height: 0.09, depth: 0.3, dz: -0.04 };

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
