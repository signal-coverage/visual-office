# One installation per company

Each company gets **its own installation**: its own game server, database and site. Nothing is
shared between companies, so one company can never see another's people, floors or layouts.
(A single installation for many companies is a different design: see "Why not one for all" at the
end.)

What a company has:

| Piece       | Where                         | One per company? |
| ----------- | ----------------------------- | ---------------- |
| Game server | Railway service               | Yes              |
| Database    | Neon project                  | Yes              |
| Site        | Vercel project                | Yes              |
| Sign-in     | Clerk application (+ its org) | Yes (see below)  |
| Voice       | LiveKit project               | Preferably       |

The code is the same for all of them. Only the settings differ.

## Adding a company

1. **Clerk.** Create a Clerk application for the company, with Google and email as sign-in
   methods. In its dashboard:
   - _Organizations settings_ → **Membership optional** (not _required_): otherwise Clerk makes
     every new person create an organization before they can be let in, and they have to sign
     in twice;
   - _User & authentication → Access mode_ → **Invite-only**: nobody can create an account
     without an invitation, so strangers cannot sign up (or create organizations of their own);
   - leave organizations enabled. You do **not** need to create the company's organization or
     copy its id: the first admin creates it from the game, and the server remembers it. (If you
     prefer, create it yourself, invite the people, and put its id in `CLERK_ORGANIZATION_ID`.)
   - Use a **production** instance for a real company. It needs a domain of its own (a valid
     FQDN, e.g. `office.acme.com`), and cannot be changed afterwards without downtime. Clerk can
     also share sessions across several domains ("satellite domains") if you ever need one
     Clerk application for several sites.
2. **Neon.** Create a project. Copy the **pooled** connection string. The server creates its
   tables the first time it starts.
3. **LiveKit.** Create a project, or reuse one and give each company a different
   `VOICE_ROOM_PREFIX`. Without a prefix two companies on one project talk in the **same**
   voice rooms (`office`, `office-meeting`).
4. **Railway.** Create a service from this repository (it builds the `Dockerfile`). Add the
   server variables below. Note the public address it gets.
5. **Vercel.** Create a project from this repository and add the site variables below. Point
   its domain at it, and put that domain in Railway's `ALLOWED_ORIGINS` and in Clerk.
6. **Check the settings** before deploying (see below).
7. **Deploy**, then **invite the first admin** (see below). They open the email, create their
   account, and the game offers them to **set the company up**: they create the organization
   there. Then they use **Invite people** to bring the rest, and **Manage people** to name the
   floor heads.

## Inviting the first admin

With sign-up by invitation only, nobody can create an account before the company exists, so the
first admin has to be invited by you:

```
npm run invite -- --dry-run --site https://office.acme.com    (shows what it would send)
npm run invite -- --site https://office.acme.com              (sends it)
```

It invites the emails in `ADMIN_EMAILS` (or the ones you name with `--email`), and the link in the
email lands on the company's own site, on the account creation page. Every invitation is a real
email: use `--dry-run` first. The people the admin invites afterwards, from **Invite people** in
the game, are invited by Clerk the same way. If an invitation link lands on a Clerk page instead
of the company's site, set the sign-up path of the instance to the site's address in the Clerk
dashboard (_Paths_): the game recognises an invitation wherever it lands on its page.

## The settings

**Server** (Railway). `NODE_ENV=production` comes from the `Dockerfile`, and `PORT` from Railway.

| Variable                     | Value                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`               | The company's Neon connection string (pooled)                                  |
| `CLERK_SECRET_KEY`           | The company's Clerk secret key (`sk_…`)                                        |
| `VITE_CLERK_PUBLISHABLE_KEY` | Its publishable key (`pk_…`): the same one the site uses                       |
| `CLERK_ORGANIZATION_ID`      | _Optional._ The company's organization (`org_…`), if you set it up yourself    |
| `ADMIN_EMAILS`               | The verified email(s) of the first admin(s)                                    |
| `ALLOWED_ORIGINS`            | The company's site, e.g. `https://office.acme.com`                             |
| `LIVEKIT_URL`                | `wss://….livekit.cloud`                                                        |
| `LIVEKIT_API_KEY`            | The LiveKit key                                                                |
| `LIVEKIT_API_SECRET`         | The LiveKit secret                                                             |
| `VOICE_ROOM_PREFIX`          | The company's short name (`acme`), **needed** if the LiveKit project is shared |

Leave out `FLOOR_ADMIN_TOKEN` unless you need scripts: it gives full access to whoever holds it.

**Site** (Vercel). Both are fixed when the site is built, so deploy again after changing them.

| Variable                     | Value                                    |
| ---------------------------- | ---------------------------------------- |
| `VITE_SERVER_URL`            | `wss://` + the company's Railway address |
| `VITE_CLERK_PUBLISHABLE_KEY` | The company's publishable key (`pk_…`)   |

Never put a secret key, the database address or LiveKit's keys on the site.

## Checking a company's settings

Put each side's variables in a file of `NAME=value` lines, **outside git** (names that start
with `.env` are ignored by this repository), then:

```
npm run check:company -- --server .env.acme.server --site .env.acme.site
```

It reports what is wrong without printing what the settings hold, and exits with an error if
something would stop the company from working. It checks, among others, that:

- the database, the Clerk keys and the organization are set and look right;
- the site and the server use the **same** Clerk keys;
- the site's server address is a `wss://` one;
- the allowed origins are proper site addresses;
- voice is on, and that there is a room prefix.

It cannot check what only the dashboards know (that the organization really is the company's,
that the Clerk domain matches the site, that the invitations went out).

## Limits, and what to do about each

- **Every company is its own thing to keep up.** An update to the code means deploying each
  installation. _Instead:_ Railway and Vercel redeploy from the same repository on every push,
  so the work is connecting each one once; keep a list of the companies and their addresses.
- **Cost grows with each company** (a Railway service each, and a Vercel project and Neon
  project, which can be free at small sizes). _Instead:_ when companies are many, the single
  installation below.
- **Nothing says which companies exist.** The list lives in your head and in the dashboards.
  _Instead:_ a short file in a private place with each company, its addresses and the date it was
  created.

## Why not one for all

One installation for many companies is cheaper to run with many customers, but it needs every
table to carry the company, the floors and the game rooms to be separate per company, the voice
rooms to be named per company, the company to come from the sign-in token instead of a setting,
and admins to be kept in the database. A mistake there can show one company's data to another.
It is a larger change than this one; it is worth it when there are dozens of companies, not
before.
