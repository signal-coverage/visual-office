/** Why somebody was not let in, as the server decides it. */
export type AuthRefusal = "missing" | "invalid" | "not_member" | "unavailable";

/** The person has to sign in (again): there was no token, or it was not valid or had expired. */
export const AUTH_REQUIRED_CODE = 4401;
/** Signed in, but not part of the company: their account was never invited. */
export const NOT_MEMBER_CODE = 4403;
/** The sign-in service could not be reached to check; try again in a moment. */
export const AUTH_UNAVAILABLE_CODE = 4503;

const MESSAGES = new Map<number, string>([
  [AUTH_REQUIRED_CODE, "Sign in to enter the office."],
  [
    NOT_MEMBER_CODE,
    "Your account is not part of this company. Ask for an invitation.",
  ],
  [
    AUTH_UNAVAILABLE_CODE,
    "Could not check your sign-in right now. Try again in a moment.",
  ],
]);

/** The code and the words to refuse somebody with. */
export function refusalFor(reason: AuthRefusal): {
  code: number;
  message: string;
} {
  const code =
    reason === "not_member"
      ? NOT_MEMBER_CODE
      : reason === "unavailable"
        ? AUTH_UNAVAILABLE_CODE
        : AUTH_REQUIRED_CODE;
  return { code, message: MESSAGES.get(code)! };
}

/** What to tell the person for a code the server refused them with, or null if it is not one of these. */
export function messageForAuthCode(code: number): string | null {
  return MESSAGES.get(code) ?? null;
}
