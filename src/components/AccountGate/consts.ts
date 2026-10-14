export const LOADING = "Checking your account…";

export const INVITATION = {
  title: "You need an invitation",
  body: "Your account is not part of this company yet. Your company's administrator has to invite you: you will get an email with a link. Open it, then come back here.",
  signedInAs: "Signed in as",
  retry: "I accepted the invitation: check again",
} as const;

export const NOT_READY = {
  title: "Your company is not set up yet",
  body: "The administrator has to sign in first and set the company up. Try again once they have.",
  retry: "Check again",
} as const;

export const SET_UP = {
  title: "Set up your company",
  body: "You are the first administrator. Create your company's organization: it is where you will invite the people who may use this office.",
  saving: "Setting your company up…",
  failed:
    "Could not set the company up. It may already be set up, or the server did not answer.",
  retry: "Try again",
} as const;

export const FAILED = {
  title: "Could not check your account",
  body: "The server did not answer. Try again in a moment.",
  retry: "Try again",
  signedOut: "Your sign-in is no longer valid. Sign out and sign in again.",
} as const;
