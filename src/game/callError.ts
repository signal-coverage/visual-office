const MESSAGES = {
  blocked:
    "The microphone is blocked. Allow it for this site in your browser settings, then tap to try again.",
  missing: "No microphone was found. Plug one in, then tap to try again.",
  busy: "Another app is using the microphone. Close it, then tap to try again.",
  insecure:
    "This browser only lets a page use the microphone over a secure https:// address. Open the office from one, then try again.",
  failed:
    "Could not join the voice call. Check your connection, then tap to try again.",
} as const;

/**
 * What to tell somebody whose call could not be joined, from the error the
 * browser or the call library gave. Only the name of the error decides: its
 * message may carry addresses or tokens, and is for the console, not the person.
 */
export function callErrorText(error: unknown): string {
  const name =
    typeof error === "object" && error !== null
      ? (error as { name?: unknown }).name
      : undefined;
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return MESSAGES.blocked;
    case "NotFoundError":
    case "OverconstrainedError":
      return MESSAGES.missing;
    case "NotReadableError":
    case "AbortError":
      return MESSAGES.busy;
    case "DeviceUnsupportedError":
    case "SecurityError":
      return MESSAGES.insecure;
    default:
      return MESSAGES.failed;
  }
}
