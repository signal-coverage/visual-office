/** What a player is doing, as the others see it next to their name. */
export const STATUSES = ["available", "busy", "dnd", "away"] as const;
export type Status = (typeof STATUSES)[number];

export const DEFAULT_STATUS: Status = "available";

export const STATUS_LABELS: Readonly<Record<Status, string>> = {
  available: "Available",
  busy: "In a meeting",
  dnd: "Do not disturb",
  away: "Away",
};

/** The colour of each status dot, on the name tag and in the people list. */
export const STATUS_COLORS: Readonly<Record<Status, string>> = {
  available: "#3fb950",
  busy: "#e5484d",
  dnd: "#a855f7",
  away: "#f5a524",
};

/** How long without any input before somebody who is available shows as away. */
export const IDLE_AFTER_MS = 5 * 60 * 1000;

const isStatus = (value: unknown): value is Status =>
  typeof value === "string" && (STATUSES as readonly string[]).includes(value);

/** The status in the room's state, which is only text: the default when it is not one of the list. */
export function asStatus(raw: unknown): Status {
  return isStatus(raw) ? raw : DEFAULT_STATUS;
}

/** Validates an untrusted `status` message from a client: the status chosen, or null when it is not one of the list. */
export function sanitizeStatus(payload: unknown): Status | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { status } = payload as Record<string, unknown>;
  return isStatus(status) ? status : null;
}

/** Validates an untrusted `idle` message from a client: a real boolean, or null. */
export function sanitizeIdle(payload: unknown): boolean | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { idle } = payload as Record<string, unknown>;
  return typeof idle === "boolean" ? idle : null;
}

/** Whether the last input was long enough ago. */
export function isIdle(
  lastInputAt: number,
  now: number,
  afterMs: number = IDLE_AFTER_MS,
): boolean {
  return now - lastInputAt >= afterMs;
}

export interface StatusInputs {
  /** What the player chose. */
  manual: Status;
  /** They have not touched anything for a while. */
  idle: boolean;
  /** They are in a private zone (a meeting). */
  inZone: boolean;
}

/**
 * What everybody sees. A choice other than available is kept as it is; only
 * somebody who is available can be taken for busy (in a private zone) or away
 * (no input), and goes back to available when that stops.
 */
export function effectiveStatus({
  manual,
  idle,
  inZone,
}: StatusInputs): Status {
  if (manual !== "available") return manual;
  if (inZone) return "busy";
  return idle ? "away" : manual;
}

/** The status after this one in the list, for a key that goes round them. */
export function nextStatus(current: Status): Status {
  return STATUSES[(STATUSES.indexOf(current) + 1) % STATUSES.length];
}
