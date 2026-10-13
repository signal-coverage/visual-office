// Sends the invitation that lets somebody create an account, for when sign-up is by
// invitation only. This is how the first admin of a company gets in: nobody can sign
// up before the company exists, so somebody has to invite them. See docs/COMPANIES.md.
//
//   npm run invite -- --dry-run                      (shows what it would send, sends nothing)
//   npm run invite                                   (invites the emails in ADMIN_EMAILS)
//   npm run invite -- --email ana@acme.com --site https://office.acme.com
//
// It reads CLERK_SECRET_KEY (and ADMIN_EMAILS, ALLOWED_ORIGINS) from the environment or
// from .env.local / .env, like the server. It never prints a key. Every invitation is a
// real email: try it with --dry-run first.
import { createClerkClient } from "@clerk/backend";
import { inviteRequestsFrom } from "../server/invite.ts";
import { loadEnvIfPresent } from "../server/loadEnv.ts";

loadEnvIfPresent(".env.local");
loadEnvIfPresent(".env");

const args = process.argv.slice(2);
const values = (flag) =>
  args.flatMap((arg, at) =>
    arg === flag && args[at + 1] ? [args[at + 1]] : [],
  );
const dryRun = args.includes("--dry-run");

async function main() {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) {
    console.error("CLERK_SECRET_KEY is not set: nothing to invite with.");
    return 2;
  }

  const plan = inviteRequestsFrom(
    { emails: values("--email"), site: values("--site")[0] },
    process.env,
  );
  if (!plan.ok) {
    console.error(plan.error);
    return 2;
  }

  if (dryRun) {
    for (const { emailAddress, redirectUrl } of plan.invitations)
      console.log(
        `Would invite ${emailAddress} (link lands on ${redirectUrl})`,
      );
    console.log("Dry run: nothing was sent.");
    return 0;
  }

  const clerk = createClerkClient({ secretKey });
  let failed = 0;
  for (const { emailAddress, redirectUrl } of plan.invitations) {
    try {
      // ignoreExisting: asking again (to resend it) is fine
      await clerk.invitations.createInvitation({
        emailAddress,
        redirectUrl,
        ignoreExisting: true,
      });
      console.log(
        `✔ Invited ${emailAddress}: they will get an email with the link`,
      );
    } catch (error) {
      failed++;
      const reason =
        error?.errors?.[0]?.longMessage ?? error?.message ?? "unknown error";
      console.error(`✖ Could not invite ${emailAddress}: ${reason}`);
    }
  }
  return failed > 0 ? 1 : 0;
}

// Let the connections close by themselves instead of cutting them with process.exit
process.exitCode = await main();
