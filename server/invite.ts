type Env = Record<string, string | undefined>;

export interface InviteRequest {
  emailAddress: string;
  /** Where the person lands after opening the invitation: the sign-up on the site. */
  redirectUrl: string;
}

export type InviteResult =
  { ok: true; invitations: InviteRequest[] } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE = /^(https:\/\/[^/\s]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

/**
 * The invitations to send, from what the person running the command said and the
 * server's settings. This is how the first admin of a company gets in when
 * sign-up is by invitation only: nobody else can sign up before the company exists.
 */
export function inviteRequestsFrom(
  args: { emails?: string[]; site?: string },
  env: Env,
): InviteResult {
  const named = args.emails ?? [];
  const fromEnv = (env.ADMIN_EMAILS ?? "").split(",");
  const emails = [
    ...new Set(
      (named.length > 0 ? named : fromEnv)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (emails.length === 0)
    return {
      ok: false,
      error:
        "Nobody to invite: name them with --email, or set ADMIN_EMAILS to invite the first admins.",
    };
  const bad = emails.find((email) => !EMAIL.test(email));
  if (bad) return { ok: false, error: `"${bad}" is not an email address.` };

  const firstOrigin = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .find(Boolean);
  const site = (args.site ?? firstOrigin)?.trim().replace(/\/+$/, "");
  if (!site)
    return {
      ok: false,
      error:
        "Which site? Say it with --site https://office.example.com, or set ALLOWED_ORIGINS.",
    };
  if (!SITE.test(site))
    return {
      ok: false,
      error: `The site "${site}" must be an https address without a path (for example https://office.example.com), or http://localhost for trying it out.`,
    };

  return {
    ok: true,
    invitations: emails.map((emailAddress) => ({
      emailAddress,
      redirectUrl: `${site}/?mode=sign-up`,
    })),
  };
}
