import { WALK_SPEED } from "../../shared/constants.ts";

export interface WalkPose {
  /** Rotation (radians) around the x axis of each limb. Positive swings forward. */
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  /** How far the body rises (meters) at this point of the stride. */
  bob: number;
}

/** Stride progress per meter walked, so feet do not slide over the floor. */
export const STRIDE_RADIANS_PER_METER = 2.2;

const MAX_LEG_SWING = 0.7;
const ARM_SWING_RATIO = 0.8;
const MAX_BOB = 0.03;
/** Running swings wider than walking, but not without limit. */
const MAX_INTENSITY = 1.5;

/**
 * Limb angles for a point of the walk cycle. `phase` advances with distance
 * walked; `speed` (m/s) scales how pronounced the motion is, down to a still pose.
 */
export function walkPose(phase: number, speed: number): WalkPose {
  const intensity = Math.min(MAX_INTENSITY, Math.max(0, speed) / WALK_SPEED);
  if (intensity === 0) return { legL: 0, legR: 0, armL: 0, armR: 0, bob: 0 };

  const swing = Math.sin(phase) * MAX_LEG_SWING * intensity;
  return {
    legL: swing,
    legR: -swing,
    armL: -swing * ARM_SWING_RATIO,
    armR: swing * ARM_SWING_RATIO,
    bob: Math.abs(Math.cos(phase)) * MAX_BOB * intensity,
  };
}
