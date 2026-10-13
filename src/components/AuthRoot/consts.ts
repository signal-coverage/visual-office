/** The key of the sign-in service; without it the office does not ask anybody to sign in. */
export const PUBLISHABLE_KEY: string | undefined = import.meta.env
  .VITE_CLERK_PUBLISHABLE_KEY;

export const SIGN_IN_TITLE = "Visual Office";
export const SIGN_IN_SUBTITLE = "Sign in to enter the office.";
export const SIGN_UP_SUBTITLE =
  "Create your account with the invitation you received.";
export const INVITE_ONLY_NOTE =
  "Accounts are created by invitation only. If you do not have one yet, wait for the invitation email from your company's administrator: you cannot sign up on your own.";
export const LOADING_TEXT = "Loading…";
