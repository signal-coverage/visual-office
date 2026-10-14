/** How high the top of a chair's seat is: where a seated person's hips rest. */
export const SEAT_HEIGHT = 0.45;

/** Why the server did not seat somebody. */
export type SeatRefusal =
  "unknown" | "seated" | "taken" | "far" | "blocked" | "cooldown";

export const SEAT_REFUSAL_TEXT: Readonly<Record<SeatRefusal, string>> = {
  unknown: "That seat is not there any more.",
  seated: "You are already sitting.",
  taken: "Somebody is already sitting there.",
  far: "Get closer to sit down.",
  blocked: "You cannot reach that seat from here.",
  cooldown: "Wait a moment.",
};

/** The server's answer to somebody who sat or stood: where they are now. `seat` is "" once they stand. */
export interface SeatedMessage {
  seat: string;
  x: number;
  z: number;
  yaw: number;
}

export interface SeatRefusedMessage {
  reason: SeatRefusal;
}

/** The shape of an id the layout gives a piece: what it is, a colon and its place in the list. */
const SEAT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*:\d{1,4}$/;
const MAX_SEAT_ID = 64;

/** Validates an untrusted `seat` message from a client: the id of the seat asked for, or null. */
export function sanitizeSeatRequest(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { seat } = payload as Record<string, unknown>;
  return typeof seat === "string" &&
    seat.length <= MAX_SEAT_ID &&
    SEAT_ID.test(seat)
    ? seat
    : null;
}
