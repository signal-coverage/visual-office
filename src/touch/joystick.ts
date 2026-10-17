/** How far (px) the thumb can go from the middle of the joystick before it counts as pushed all the way. */
export const STICK_RADIUS = 56;
/** The share of the radius, around the middle, that does nothing: a resting thumb is not a push. */
export const DEAD_ZONE = 0.15;
/** The share of the radius from which the person runs instead of walking. */
export const RUN_AT = 0.85;

/** What the joystick asks for: the same two axes as W/S and D/A, with every value from -1 to 1. */
export interface StickVector {
  /** Positive: forward. */
  forward: number;
  /** Positive: to the right. */
  strafe: number;
  run: boolean;
}

/**
 * The push of a thumb that is `dx` right and `dy` down (screen pixels) from the
 * middle of the joystick. Nothing happens inside the dead zone, the push grows
 * from there to the edge, and near the edge the person runs at full speed.
 */
export function joystickVector(
  dx: number,
  dy: number,
  radius: number = STICK_RADIUS,
): StickVector {
  const distance = Math.hypot(dx, dy);
  const dead = radius * DEAD_ZONE;
  if (distance <= dead) return { forward: 0, strafe: 0, run: false };

  const run = distance >= radius * RUN_AT;
  const strength = run ? 1 : Math.min(1, (distance - dead) / (radius - dead));
  return {
    forward: (-dy / distance) * strength,
    strafe: (dx / distance) * strength,
    run,
  };
}
