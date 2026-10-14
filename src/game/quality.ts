/** How much the game asks of the computer: the choice in the menu, and what each level means. */
export const QUALITY_CHOICES = ["auto", "high", "low"] as const;
export type QualityChoice = (typeof QUALITY_CHOICES)[number];
export type QualityLevel = "high" | "low";

/** A choice read from something untrusted (storage, a menu value): anything unknown is auto. */
export function sanitizeQuality(value: unknown): QualityChoice {
  return QUALITY_CHOICES.find((choice) => choice === value) ?? "auto";
}

export interface QualityProfile {
  /** The most device pixels drawn for each screen pixel. */
  pixelRatioCap: number;
  /** Whether the sun casts shadows. */
  shadows: boolean;
  /** Smooths the edges. It is decided when the graphics context is created: a change waits for the next load. */
  antialias: boolean;
  /** Distant people are moved and animated only one frame in this many. */
  farUpdateEvery: number;
  /** Beyond this distance (meters) a person counts as far. */
  farDistance: number;
  /** Whether the furniture keeps its small details (keys, mugs, casters, handles). */
  furnitureDetail: "high" | "low";
  /** Whether people keep the small things they wear (a watch, a badge, a bridge on their glasses). */
  avatarDetail: "high" | "low";
}

export const QUALITY_PROFILES: Readonly<Record<QualityLevel, QualityProfile>> =
  {
    high: {
      pixelRatioCap: 2,
      shadows: true,
      antialias: true,
      farUpdateEvery: 1,
      farDistance: Infinity,
      furnitureDetail: "high",
      avatarDetail: "high",
    },
    low: {
      pixelRatioCap: 1,
      shadows: false,
      antialias: false,
      farUpdateEvery: 3,
      farDistance: 12,
      furnitureDetail: "low",
      avatarDetail: "low",
    },
  };

/** Below this many frames per second the game does not feel smooth. */
export const AUTO_SLOW_FPS = 30;
/** How long the frames must stay slow, without a good moment in between, before auto gives up detail. */
export const AUTO_SLOW_SECONDS = 4;
/** The first seconds are not measured: models and textures are still loading. */
export const AUTO_WARMUP_SECONDS = 3;
/** A frame longer than this was a hidden tab or a suspended computer, not a slow game. */
const LONGEST_COUNTED_FRAME_SECONDS = 1;

export function resolveLevel(
  choice: QualityChoice,
  auto: { softwareRendering: boolean; autoLevel: QualityLevel },
): QualityLevel {
  if (choice !== "auto") return choice;
  return auto.softwareRendering ? "low" : auto.autoLevel;
}

export function pixelRatioFor(
  level: QualityLevel,
  devicePixelRatio: number,
): number {
  return Math.min(devicePixelRatio, QUALITY_PROFILES[level].pixelRatioCap);
}

/** Whether somebody `distance` meters away is moved on this frame. */
export function farUpdateDue(
  frame: number,
  distance: number,
  profile: QualityProfile,
): boolean {
  return (
    distance <= profile.farDistance || frame % profile.farUpdateEvery === 0
  );
}

export interface AutoQualityState {
  level: QualityLevel;
  /** Seconds of the current unbroken slow spell. */
  slowSeconds: number;
  /** Seconds left before measuring starts. */
  warmupSeconds: number;
}

export function startAutoQuality(softwareRendering: boolean): AutoQualityState {
  return {
    level: softwareRendering ? "low" : "high",
    slowSeconds: 0,
    warmupSeconds: AUTO_WARMUP_SECONDS,
  };
}

/**
 * Decides, frame by frame, whether auto should give up detail. It only ever goes
 * down: coming back up would make the game fast again and so start a cycle of
 * going down and up. The person can pick High in the menu to try again.
 */
export function stepAutoQuality(
  state: AutoQualityState,
  frame: { fps: number; frameSeconds: number },
): AutoQualityState {
  if (state.level === "low") return state;
  if (frame.frameSeconds > LONGEST_COUNTED_FRAME_SECONDS)
    return { ...state, slowSeconds: 0 };
  if (state.warmupSeconds > 0)
    return {
      ...state,
      warmupSeconds: Math.max(0, state.warmupSeconds - frame.frameSeconds),
    };
  // fps is 0 until the meter has completed its first window
  if (frame.fps <= 0) return state;
  if (frame.fps >= AUTO_SLOW_FPS) return { ...state, slowSeconds: 0 };
  const slowSeconds = state.slowSeconds + frame.frameSeconds;
  return {
    ...state,
    slowSeconds,
    level: slowSeconds >= AUTO_SLOW_SECONDS ? "low" : "high",
  };
}

const LEVEL_LABELS: Readonly<Record<QualityLevel, string>> = {
  high: "High",
  low: "Low",
};

/** What the diagnostics show: the level in use, and that auto chose it. */
export function describeQuality(
  choice: QualityChoice,
  level: QualityLevel,
): string {
  return choice === "auto"
    ? `Auto (${LEVEL_LABELS[level]})`
    : LEVEL_LABELS[level];
}
