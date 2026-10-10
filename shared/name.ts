export const MAX_NAME_LENGTH = 24;
export const DEFAULT_NAME = "Guest";

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** Cleans a display name coming from the user or, on the server, from an untrusted client. */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_NAME;
  const clean = raw
    .replace(CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return clean || DEFAULT_NAME;
}
