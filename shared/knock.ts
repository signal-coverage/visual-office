/** The least time between two knocks of the same player. */
export const KNOCK_COOLDOWN_MS = 5000;

/** How close (meters) to a private room's boundary somebody has to be to knock on it. */
export const KNOCK_DOOR_DISTANCE = 2.5;
/** How far (meters) the person being knocked on can be. */
export const KNOCK_AIM_DISTANCE = 3;
/** How far off straight ahead (radians) the person can be and still be the one aimed at. */
export const KNOCK_AIM_ANGLE = Math.PI / 6;

/** What the server tells somebody who is being knocked on. */
export interface KnockMessage {
  /** The session of whoever knocked. */
  id: string;
  name: string;
  /** The private room that was knocked on, or null when it was the person. */
  place: string | null;
}

/** What the server answers to whoever knocked: whether there was anybody to knock on. */
export interface KnockAck {
  knocked: boolean;
  /** Set when it was too soon after the last one. */
  reason?: "cooldown";
}

/** What somebody who is knocked on reads. */
export function knockText(name: string, placeLabel: string | null): string {
  return placeLabel
    ? `${name} is knocking at the ${placeLabel}`
    : `${name} is knocking`;
}

/** What the knocker reads when there was nobody to knock on, or too soon. */
export function knockAckText(ack: KnockAck): string {
  if (ack.reason === "cooldown") return "Wait a moment before knocking again.";
  return ack.knocked
    ? "You knocked."
    : "Nobody to knock on: stand at a private room's door, or face somebody.";
}
