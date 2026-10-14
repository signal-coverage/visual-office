import { EMOTE_DURATION_MS, type Emote } from "../../shared/emotes.ts";

/** An arm's turn (radians): `x` raises it forward and up, `z` swings it sideways. */
export interface ArmPose {
  x: number;
  z: number;
}

export interface EmotePose {
  armL: ArmPose;
  armR: ArmPose;
  /** How far the body rises (meters). */
  bob: number;
  /** How far the body turns from side to side (radians). */
  sway: number;
}

const EASE_IN_MS = 250;
const EASE_OUT_MS = 350;

/** Straight up is PI. */
const UP = 2.9;
const FORWARD = 1.3;

/** 0 to 1 and back: the arms rise and settle instead of jumping. */
function envelope(elapsedMs: number): number {
  const rise = Math.min(1, elapsedMs / EASE_IN_MS);
  const fall = Math.min(1, (EMOTE_DURATION_MS - elapsedMs) / EASE_OUT_MS);
  const t = Math.max(0, Math.min(rise, fall));
  return t * t * (3 - 2 * t);
}

const rest = (): EmotePose => ({
  armL: { x: 0, z: 0 },
  armR: { x: 0, z: 0 },
  bob: 0,
  sway: 0,
});

/** The pose of the arms and body `elapsedMs` after `emote` started. At rest outside its time. */
export function emotePose(emote: Emote, elapsedMs: number): EmotePose {
  if (elapsedMs < 0 || elapsedMs >= EMOTE_DURATION_MS) return rest();
  const e = envelope(elapsedMs);
  const s = elapsedMs / 1000;
  const pose = rest();

  switch (emote) {
    case "wave":
      pose.armR = { x: UP * e, z: Math.sin(s * 14) * 0.45 * e };
      break;
    case "raise":
      pose.armR = { x: UP * e, z: Math.sin(s * 3) * 0.05 * e };
      break;
    case "clap": {
      const together = (0.1 + 0.3 * Math.abs(Math.sin(s * 10))) * e;
      pose.armL = { x: FORWARD * e, z: together };
      pose.armR = { x: FORWARD * e, z: -together };
      break;
    }
    case "thumbs":
      pose.armR = { x: FORWARD * e, z: 0 };
      pose.bob = Math.abs(Math.sin(s * 7)) * 0.02 * e;
      break;
    case "dance":
      pose.armL = { x: (2.2 + Math.sin(s * 9) * 0.6) * e, z: 0.5 * e };
      pose.armR = { x: (2.2 - Math.sin(s * 9) * 0.6) * e, z: -0.5 * e };
      pose.bob = Math.abs(Math.sin(s * 9)) * 0.07 * e;
      pose.sway = Math.sin(s * 4.5) * 0.35 * e;
      break;
  }
  return pose;
}
