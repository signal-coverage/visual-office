/** The code every player is disconnected with when the server is shutting down to restart: the game joins again by itself. */
export const SERVER_RESTARTING_CODE = 4012;

export const SERVER_RESTARTING_MESSAGE =
  "The server is restarting, you will be back in a moment.";

/** How many times the game tries to join again after a restart before it gives up and says so. */
export const MAX_RESTART_ATTEMPTS = 6;

const FIRST_WAIT_MS = 2000;
const STEP_MS = 3000;
const MAX_BASE_WAIT_MS = 15_000;
const SPREAD_MS = 3000;

/**
 * How long to wait before join attempt number `attempt` (from 0) after a restart,
 * or null when it is time to give up. It grows with each attempt, and a random
 * spread keeps everybody from knocking at the same moment.
 */
export function restartRetryDelayMs(
  attempt: number,
  random: () => number = Math.random,
): number | null {
  if (attempt >= MAX_RESTART_ATTEMPTS) return null;
  const base = Math.min(MAX_BASE_WAIT_MS, FIRST_WAIT_MS + attempt * STEP_MS);
  return Math.round(base + random() * SPREAD_MS);
}
