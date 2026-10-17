import { RUN_SPEED, WALK_SPEED } from "../../shared/constants.ts";

/**
 * What a person asks of their legs, whatever they ask with. `forward` and
 * `strafe` run from -1 to 1 for keys and for a joystick; a gentle push of a
 * joystick is a slower walk.
 */
export interface MoveIntent {
  /** Positive: forward. */
  forward: number;
  /** Positive: to the right. */
  strafe: number;
  run: boolean;
}

const RUN_KEY = "ShiftLeft";

/** The intent of the keys held: W A S D to walk, left Shift to run. */
export function keyIntent(keys: ReadonlySet<string>): MoveIntent {
  return {
    forward: Number(keys.has("KeyW")) - Number(keys.has("KeyS")),
    strafe: Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
    run: keys.has(RUN_KEY),
  };
}

/**
 * The velocity (m/s, on the floor) an intent gives when the camera looks along
 * `yaw`; null when there is no push. A diagonal is no faster than a straight
 * line, and a push below full strength goes in proportion slower.
 */
export function moveStep(
  intent: MoveIntent,
  yaw: number,
): { dx: number; dz: number } | null {
  const { forward, strafe } = intent;
  const length = Math.hypot(forward, strafe);
  if (length <= 0) return null;
  const speed = intent.run ? RUN_SPEED : WALK_SPEED;
  const strength = Math.min(1, length);
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  // Camera looks toward (-sin, -cos) at yaw; right vector is (cos, -sin)
  const dx = ((-sin * forward + cos * strafe) / length) * strength;
  const dz = ((-cos * forward - sin * strafe) / length) * strength;
  return { dx: dx * speed, dz: dz * speed };
}
