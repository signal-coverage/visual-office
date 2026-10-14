# The building

Status: **design**, except the floor lock (section 5), which exists. Everything else here is
agreed direction, not code.

## 1. The idea

The app is a building for one company. **Each floor is the office of one area** (marketing, sales,
development…). People walk into a floor, see who is there and talk, as today. **Only the highest
rank of an area (its lead or manager) can change that floor's layout.**

Today there is one floor (`office`, `FLOOR_ID` in [`shared/floors.ts`](../shared/floors.ts)), no
accounts, and the layout lives in [`shared/officeData.ts`](../shared/officeData.ts), edited by a
development-only tool.

## 2. Floors

A floor is a layout (furniture and models), a Colyseus room, and a name. Rooms are already one per
floor: the room name is the floor.

- **Floor id**: a short slug (`marketing`, `dev`). It is the room name and the key of its layout.
- **Layout per floor**: the same data as today (`FurnitureItem[]` plus `PropPlacement[]`), with the
  same validator (`findProblems`) and sanitizers, so a stored layout can never hold invalid data.
- **Shell**: walls, divider, whiteboard and screen are fixed code today; they become data too, per
  floor, so floors can differ in shape (planned).
- **Capacity**: each floor keeps its own 30-player limit and its own voice rooms.

_Instead of one room per floor in one process_ (if the building grows): run floors as separate game
server processes behind a small directory service. It costs more to run, and each floor stays
independent when one crashes.

## 3. People and roles

| Role       | Can do                                                     |
| ---------- | ---------------------------------------------------------- |
| Member     | Enter the floors they are allowed into, walk, talk         |
| Floor head | Everything a member can, plus edit and publish their floor |
| Admin      | Create floors, assign heads, read the audit log            |

Floor heads and admins may also moderate (see "Moderation and the audit log" below).

Rules:

- A floor has **one head role** (the highest rank of that area); who holds it comes from the
  company's directory, not from the game.
- Editing needs the head role **for that floor**. Being head of marketing gives nothing on sales.
- Entering is open to the whole company by default; a floor can be restricted to its area.

_Instead of rank from the company's directory_ (if there is no directory to read): an admin assigns
heads by hand in a small table. Simpler, but it drifts out of date when people change jobs.

## 4. Sign-in

Needed before roles mean anything. Options, with the tradeoff of each:

1. **Company single sign-in (OIDC, e.g. Google Workspace or Microsoft Entra).** People already have
   the account, and rank and area can come from the token's claims or the directory. Needs the
   company's IT to register the app. _Recommended._
2. **A hosted auth service** (Clerk, Auth0…). Fast to start, works without company IT; roles are
   kept in the service. A monthly cost and one more dependency.
3. **Our own email and password.** Full control, but we would own password storage, reset and
   abuse. Only worth it if the first two are impossible.

Whichever is chosen, the game server must verify the token itself: the client's word about who it
is, or what rank it has, is never trusted. `onAuth` in `OfficeRoom` is where that check goes; it is
also where the floor lock already refuses joins.

**Done: sign-in with Clerk (identity only).** When `CLERK_SECRET_KEY` and
`VITE_CLERK_PUBLISHABLE_KEY` are set, the game asks people to sign in (Google or email, as set in
the Clerk dashboard) and the server refuses anybody without a valid token. Without the keys
everybody may enter, as before (development without an account).

- **Who is in the company is Clerk's business.** Only the members of one Clerk organization may
  enter; people join it by invitation. Which organization it is comes from `CLERK_ORGANIZATION_ID`
  or, when that is not set, from what the first admin saved when they set the company up from the
  game (the `settings` table). Until it is set nobody is in it. The check asks Clerk's Backend API
  and remembers a yes for a minute (a no is not remembered, so somebody who has just accepted an
  invitation gets in at once).
- **What each person may do is ours.** The `users` table remembers who has signed in, and
  `floor_heads` says which floors each person is head of. `users.is_admin` marks admins; the first
  ones come from `ADMIN_EMAILS` (comma separated) and only a **verified** email counts, since
  anybody can type another person's address.
- **The name comes from the profile, never from the client.** The server calls the player what the
  profile says (full name, then username, then the part of the email before the `@`); the lobby
  shows it read-only. The token only carries the user id, so the profile is asked of Clerk and
  remembered for ten minutes (and for people already known, used as it is if Clerk cannot answer).
- **Tokens last about a minute**, so the game asks for a fresh one each time it joins, never
  before. A session that has not finished its setup steps (`pending`) is refused.
- Refusals have their own codes and words (`shared/auth.ts`): sign in (4401), not in the company
  (4403), sign-in service unavailable (4503).

**Done: the roles are checked.** The admin API (`/admin/floors/…`) now knows who is calling
(`resolveActor` in [`server/actor.ts`](../server/actor.ts)):

- **The server's own tools** (the shared `FLOOR_ADMIN_TOKEN`, or this machine in development when
  no token is set) may do anything, as before. This is what the dev editor uses.
- **A person** sends their Clerk session token as `Authorization: Bearer …`. Closing a floor,
  heartbeating, opening it, publishing, going back and vouching for a version need **admin, or head
  of that floor**; anybody else gets 403. Reading the status, the layout and its history needs only
  being signed in.
- **The identity is the token's.** For a person, the lock's holder and a layout's author are their
  user id, whatever the request says. So a head cannot sign as somebody else, and cannot open a
  floor an admin closed.
- **Production no longer needs `FLOOR_ADMIN_TOKEN` for people**: with sign-in on, heads and admins
  work with their own tokens. Without the token the machine path is off in production.

Checked with real tokens: a member is refused, a head can lock, publish, vouch and open, and an
admin made by `ADMIN_EMAILS` (any case) can too, with no floor of their own.

**Done: the editor inside the game.** Heads and admins see **Edit this floor** in the lobby; nobody
else is offered it. It opens the same plan editor, which loads as its own small chunk (about 11 kB
gzipped) only for the people who may use it.

- **Who is offered it:** the game asks `GET /admin/floors/:floor/access` with the person's token
  and shows the button only on a clear `canEdit: true`. This only decides whether to show a
  button: the server checks the role again on every call.
- **Where it talks:** straight to the game server's admin API as the person who signed in
  ([`src/editor/backend.ts`](../src/editor/backend.ts)). The editor takes an `EditorBackend`, so
  the same code runs in development (through the dev server, as "the server's own tools") and in
  the game (with the token). The lock, heartbeat and unlock use that base; when the page closes the
  floor is opened with a `keepalive` request carrying the last token (a closing page cannot ask for
  a new one, and `sendBeacon` cannot send headers).
- **What is left out inside the game:** uploading models, **Save to file** and **Export published**.
  They write files on a developer's machine, which a deployed server has none of. The models on
  offer are the ones that came with the build (`public/models`, listed by `vite.config.ts` when
  it builds).
- **CORS:** the game's site and the game server are different origins, so the admin API answers the
  browser's permission check only for `ALLOWED_ORIGINS` (comma separated), plus pages from this
  machine in development. Never `*`: the calls carry a person's token.
- The person is in the menu while editing, not in the office, so the floor they close has nobody
  of theirs inside.

Checked in a browser as an admin made by `ADMIN_EMAILS`: the button appears, the editor opens
without the developer tools, Start editing closes the floor, Publish stores a version signed with
their user id, Finish editing opens it, and the game shows what was published. With no role the
button is not offered.

**Done: naming heads from the game.** Admins see **Manage people** in the lobby: a list of everybody
who has signed in, with a checkbox per floor for "head of this floor". Only admins are offered it
(`canManage` in the `access` answer) and only admins can use it: the server answers 403 to anybody
else, a floor's head included, since the list holds everybody's email.

- `GET /admin/people` answers `{floors, people: [{id, name, email, isAdmin, headOf}]}`.
- `POST /admin/floors/:floor/heads` with `{userId, head: true | false}` names or removes a head. It
  is idempotent, answers 404 for somebody who never signed in, and works for admins and the
  server's own tools.
- People appear in the list the first time they sign in, so a head can only be named after that.
- An editor whose role is taken away while they are editing finds out on their next heartbeat
  (403) and is moved to "lost", like when the lock runs out.

Checked in a browser: an admin sees the list, ticks "head of office", and it is saved; the same
person, as **only a head**, is offered **Edit this floor** but not **Manage people**, gets 403 for
the people list and for naming heads, and can still close and open their floor.

**Done: letting people choose their name.** With sign-in on, everybody is called what their profile
says. An admin can turn on the company setting **Let people choose their own name** (**Settings** in
the lobby, admins only); the lobby then lets everybody type the name others see.

- **Off by default.** The setting is `allow_name_edit` in the existing `settings` table (no new
  table, no migration); anything other than `"true"` counts as off.
- **The server enforces it**, whatever the client shows or sends: when the player joins
  (`server/playerName.ts`), signed in with the setting off means the profile name even if the client
  sent another; with it on, the sanitized name the client sent, or the profile name when that is
  empty or not text. Without sign-in the client's name is used, as before. If the setting cannot be
  read, the name stays locked.
- `GET /admin/settings` answers `{allowNameEdit}`; `POST /admin/settings` with
  `{allowNameEdit: true | false}` (a real boolean, else 400) changes it. Admins and the server's own
  tools only: 403 for floor heads and members, 401 without a caller.
- `GET /account/session` also answers `canEditName` so the lobby knows whether to unlock the field.
  The field is prefilled with the last name the person typed (this browser), or their profile name.
- A change takes effect for the next person who joins; people already inside keep their name.

**Not done yet, and what to do about each**

- **Admins still come only from `ADMIN_EMAILS`.** Making somebody an admin from the game would let
  an admin lock themselves out by mistake. _Instead:_ allow it, but never let the last admin remove
  their own role.
- **Somebody is in the list only after signing in once**, so you cannot name a head before they
  arrive. _Instead:_ invite them first (Clerk invitations) and pre-assign by email, applied when
  they first sign in.
- **The browser shows a red 404 in the console** when a floor has no stored layout yet: expected,
  the editor treats it as "none". _Instead:_ answer 204 for "none" (it needs the dev server's
  forwarding to understand an empty reply).
- **A new model uploaded in development is not offered inside the game until the build or the dev
  server restarts**, because the list is taken when it starts. _Instead:_ a small endpoint on the
  web host that lists `public/models`.
- **Nothing sends anybody to Clerk's own pages.** The provider is told the sign-in and sign-up
  pages are this page (`signInUrl="/"`, `signUpUrl="/?mode=sign-up"`, and the fallbacks), so even a
  failed sign-in (for example with Google, from an account nobody invited) comes back here, and
  not to a second login on `accounts.dev`. The sign-in screen says that accounts are by
  invitation only and to wait for the administrator's email; the sign-up page, without an
  invitation, shows Clerk's own "Access restricted". Checked in a browser with an email and with a
  direct visit to the sign-up page; **not** with Google, which cannot be driven from a test.
- **Sign-up is by invitation only (Clerk _Access mode → Invite-only_, set in the dashboard: it
  cannot be changed from the API).** Strangers cannot create an account, so they cannot create
  organizations either. The first admin is invited with `npm run invite`; the rest are invited
  from **Invite people** in the game. People who already had an account before the switch can
  still create organizations of their own, which lets nobody in, since only the company's counts.
- **One organization is the company.** A building with several companies would need one per
  company. _Instead:_ a list of organization ids, one per tenant.

**Done: one sign-in, and what happens next (the account gate).** Right after signing in the game
asks the server what the person is (`GET /account/session`, which works for people who are not in
the company yet) and shows the right thing, with no second login and no trip to Clerk's pages:

| The person is…                           | They see                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| in the company                           | the office (the lobby)                                                   |
| not in it                                | "You need an invitation": look for the email, open the link, check again |
| signed in, company not set up, an admin  | "Set up your company": Clerk's organization list/creation, right there   |
| signed in, company not set up, not admin | "Your company is not set up yet": wait for the administrator             |

The first admin (their verified email is in `ADMIN_EMAILS`) creates the organization from the game;
the game then tells the server (`POST /account/company`), which checks that the person is an admin
and really is in that organization, and saves it once: the company is not changed from the game
afterwards. Admins also get **Invite people** in the lobby (Clerk's members screen, which sends
the invitation emails). Sign-up is part of our own page too (`?mode=sign-up`), so it does not
send anybody to Clerk's hosted pages.

**This needs one setting in the Clerk dashboard:** _Organizations settings → Membership optional_
(not _Membership required_). With _required_, Clerk keeps every new session **pending** until
the person creates or picks an organization, the game cannot tell them from a signed-out visitor,
and they have to sign in a second time. The setting cannot be changed from the API.

### Moderation and the audit log

**Done: moderation.** One policy, `mayModerate` in [`server/moderation.ts`](../server/moderation.ts): an admin, or the head of that floor, may act; nobody acts on themselves; nobody acts on an admin (a head or an admin cannot moderate an admin). The actor and the target's roles are looked up by the server when the action arrives (`server/moderationService.ts`), never taken from the message.

- **In the game:** the menu (Esc) has **Moderation** only when the server said so on joining (`moderator` message). It lists the people in the roster with **Mute**, **Let speak**, **Remove** and **Ban** (length field, 10 minutes by default); remove and ban ask first. The client sends `moderate {action, target: session, minutes?}`; the room maps the session to the account and answers `moderated`.
- **From outside the game:** `POST /admin/moderation` `{action, userId, minutes?, floor?}` (same policy; the server's own tools may too). The **People** screen uses it: Ban / Lift ban, Remove, Mute, Let speak per person, and shows who is banned and until when (`bannedUntil` in `GET /admin/people`).
- **Mute is done with LiveKit's server API**, not by asking the client: `updateParticipant` takes the microphone out of `canPublishSources` (so it cannot be turned on again) and any microphone track already published is muted with `mutePublishedTrack`. The room also remembers the session as muted, so the token it issues when the person walks into another zone has no microphone. It lasts until they leave the office. The client is told (`voiceMuted`) so its button says why it does not work.
- **Remove:** the connection is closed with code `4005` and the message _"You were removed from the office by a moderator."_. The game only joins again by itself after a layout update (4004), so there is no rejoin loop.
- **Ban:** 1 to 240 minutes (10 by default, bounded on the server whatever is sent). It also removes the person (code `4006`), and `onAuth` refuses their account id with the same code until it ends. A ban for somebody who is not in the office applies when they try to enter. Lifting one is `unban`.
- **Why bans are in memory** (`server/banStore.ts`): they are short and bounded, a table would be one more thing to keep in step for little gain. The cost: a restart forgets them, and several game servers would not share them. Bans work on signed-in accounts only, and moderation needs sign-in anyway. _Instead:_ a `bans` table (`user_id`, `until`) with a memory twin, as the other stores do.

**Done: the audit log.** Table `audit_log` (`id`, `at`, `actor_user_id`, `actor_name`, `action`, `target_user_id`, `target_name`, `floor`, `detail jsonb`), migration `008_audit_log`, `AuditStore` with a memory and a Postgres version tested against the same cases. Names are copied into the row so it still reads right later. The app only appends.

- **Recorded:** moderation (`moderation.mute|unmute|kick|ban|unban`, with the minutes), a floor closed and opened (`floor.lock|unlock`; carrying on an editing session and heartbeats are not), layouts (`layout.publish|revert|mark`, with the version), heads (`head.assign|remove`, only when something changed), the company setting (`settings.allow_name_edit`) and setting the company up (`company.setup`). Not recorded: people signing in (it would be one row per visit; the `users` table already has `seen_at`).
- **A log that cannot be written never blocks the action** (it is only reported in the server log): the action already happened.
- **Read:** `GET /admin/audit?limit=&before=` answers `{entries, nextBefore}`, newest first; `limit` defaults to 50 and is at most 200, `before` is the id of the last entry already seen. Admins and the server's own tools only (403 for heads and members). The lobby's **Activity** screen (admins) shows it as a table with **Load more**; the one-line texts come from `describeAudit` in `shared/audit.ts`.
- **Retention:** none; the table only grows (a few rows per editing session or moderation action). _Instead:_ a scheduled `DELETE FROM audit_log WHERE at < ...` (or monthly partitions) in the database provider; no cron in the app.

### Room calendars

Goal: people can see what is on in a private room (now, next, the day) so they know when to join. **Read-only, no booking, no OAuth, no Google or Microsoft API**: the credentials for those are not available, so an admin pastes an iCalendar (ICS) feed address instead.

- **Storage:** the address of each room is a row of the existing `settings` table, key `calendar_feed:<zone id>` (an empty value means none). No migration. Only admins ever receive it (it can contain a secret token): members get titles and times only.
- **Admin API** (`server/calendarAdmin.ts`, admins and server tools; 401/403 otherwise): `GET /admin/calendars` lists the rooms with their address; `POST /admin/calendars` `{room, url}` validates, saves and tests it (answers `{test: {ok, upcoming} | {ok: false, error}}`), an empty `url` removes it; `POST /admin/calendars/test` `{url}` only tests. Audit actions `calendar.set` and `calendar.clear` record who and the room, never the address.
- **Member API:** `GET /calendar?dayStart=&dayEnd=&date=` (the day of the viewer, in ms plus `YYYY-MM-DD`; signed in when sign-in is on) answers, per room, `current`, `next` and `today` (title, start, end, all-day; no attendees, no descriptions; titles are cleaned and cut at 80 characters, 30 events per day).
- **Fetcher** (`server/calendarFetch.ts`): https only (`webcal://` is read as https), port 443, no credentials in the address, no local-looking names; the name is resolved and **every** address must be public (no private, loopback, link-local, CGNAT, multicast or reserved IPv4/IPv6, including IPv4-mapped and 6to4), and the connection goes to the address that was checked, so the name cannot change in between. Each redirect (3 at most) is checked again. 1 MB and 5 s caps, content type ignored (the body must contain `BEGIN:VCALENDAR`), no compression. Errors never include the address.
- **Cache** (`server/calendarService.ts`): a feed is read at most every 5 minutes; if a read fails the last good answer keeps being served (marked stale in the Calendar screen) and the feed is retried after 1 minute. One request is shared between people asking at once.
- **Parser** (`server/ics.ts`): DTSTART/DTEND/DURATION, all-day events, UTC times, TZID times converted with `Intl` (IANA names and the common Windows names Outlook uses), line folding, escaped text, RRULE DAILY/WEEKLY/MONTHLY with INTERVAL, COUNT, UNTIL, BYDAY (with an ordinal for monthly) and BYMONTHDAY, EXDATE, moved or cancelled single occurrences (RECURRENCE-ID), cancelled events ignored. It expands only a bounded window (2 days back, 7 ahead) and never throws: garbage gives an empty list.
- **Limits:** a TZID it does not know, and floating times without `X-WR-TIMEZONE`, are read as UTC; YEARLY and other frequencies, RDATE and WKST are ignored (a YEARLY event shows only its first date). Feed changes take up to 5 minutes to show, and the badge refreshes every minute.
- **Client:** `src/calendar/` (fetch, and pure formatters in the time zone of the viewer via `Intl`), the badge (`CalendarBadge`, main chunk, one line), and two lazy screens: `CalendarView` (menu item **Room calendars**) and `CalendarsAdmin` (lobby button **Calendars**, admins).
- **Test-only flag:** `CALENDAR_ALLOW_LOCAL_FOR_TESTS=1` lets feeds be plain http and on this machine so a local test server can serve an ICS. `calendarOptionsFromEnv` ignores it when `NODE_ENV=production` (tested), and the server prints a warning when it is on.
- _Instead (later):_ a real Google/Microsoft OAuth integration would give push updates, private calendars without a secret URL and booking from the game. It needs an app registration and credentials per company, token storage and refresh; the room-facing API above would stay the same.

### Looks and the in-game menu

Esc (or the **Menu** button) releases the mouse and opens the menu: your character, the controls,
options and leaving the office. The look is edited live: the client sends `appearance`, the server
sanitises it (`nextLook`), applies a 400 ms cooldown and updates the player, so the other clients
rebuild that avatar. Who may change it is decided in one place, `mayChangeLook` in
`server/look.ts` (everybody, for now). Signed-in people keep their last look in
`users.appearance` (migration `007_user_appearance`), returned by `GET /account/session`; others
keep it in the browser. Options (mouse sensitivity, key hints) live in the browser only
(`visual-office:settings`).

### Presence status and emotes

Each player shows what they are doing: available, in a meeting, do not disturb or away. It is the
`status` field of the `Player` schema, so everybody sees it as a dot on the name tag, in the people
list, and in the menu (Esc, **Your status**). The server decides the value players see
(`effectiveStatus` in `shared/presence.ts`):

- The player's choice (`status` message, 400 ms cooldown, only values from the list) wins when it is
  not available.
- An available player in a private zone shows as in a meeting; an available one with no input for
  `IDLE_AFTER_MS` (5 minutes, sent by the game as an `idle` message) shows as away and is available
  again at the next input. A do-not-disturb is never overridden.
- Who may change it is `mayChangeStatus` in `server/presence.ts` (everybody, for now).

Emotes are a fixed list (`shared/emotes.ts`). The client sends `emote`; the server validates it
against the list, allows one a second per player and broadcasts `{id, emote}`. Each client moves the
avatar's arms (`src/game/emotePose.ts`, pure and tested) and floats an icon for 3 seconds. Nothing
is stored: a player who joins later sees nothing of an emote already over.

Not done: the idle rule is checked by the browser, so a modified client can pretend to be away or
back; it only changes its own dot. Status is not kept between visits.

### Chat scopes, direct messages and knocks

The `chat` message carries `{text, scope, to?}` (`sanitizeChatRequest` in `shared/chat.ts`; no scope means everyone, for older pages). The server alone picks the recipients (`routeChat` in `server/chatRouting.ts`, pure and tested), from where players really are, with the same 400 ms cooldown and sanitising as before:

- **everyone**: the whole room. **nearby**: follows the voice: in a private zone the people in that zone, in the open office the people in the open office who could be heard (`peerVolume > 0`, under 10 m).
- **dm**: only the sender and the target (a session id the server looks up). Unknown or gone target: `chatRefused {reason: "gone"}`; yourself: `"self"`.
- Each copy carries `quiet` set by the server: the sender's own copy, and any copy for a do-not-disturb player. The client shows those in the panel and in the unread badge but makes no toast, sound or desktop notification.

The client side is `src/chat/`: `alerts.ts` (what a message should do: unread, toast text, tab title `(2) Visual Office` while hidden, desktop notification rule), `sound.ts` (generated WebAudio beeps, no files) and `desktop.ts` (browser Notification API). Settings `notificationSound` (default on) and `desktopNotifications` (default off; turning it on in Esc, Options, asks the browser for permission from the click) are in `src/App/settings.ts`.

**Knock** (`knock` message, key K or the menu): `routeKnock` in `server/knockRouting.ts` uses the server's own position and yaw of the sender. Within 2.5 m of a private room's boundary it tells the people inside (`place` is the zone); otherwise it tells the nearest person in the same room within 3 m and 30 degrees of where the sender faces. Do-not-disturb players are skipped without the knocker learning it. One knock accepted per 5 s per player (`knocked {reason: "cooldown"}` otherwise). No door logic changes.

Not done: nothing is stored (late joiners see no history); the unread count is only for direct messages; the nearby rule uses the voice distance, not walls.

## 5. The floor lock (implemented)

Editing a floor closes it. The aim: nobody is inside while the plan changes, and two editors cannot
overwrite each other.

**Behaviour**

1. The editor asks the game server to lock the floor, naming itself (`holder`).
2. The server tells everyone inside (`closing`, with the seconds left). After the grace period
   (default 10 s, 0–120) it sends them back to the menu with code `4003`.
3. While locked, `onAuth` rejects every join with the same code and the message _"This floor is
   closed while it is being edited. Try again in a moment."_
4. The editor sends a heartbeat every 15 s. The lock lasts **45 s** without one, so a crashed
   editor cannot keep the floor shut. Closing the tab sends an unlock with `sendBeacon`.
5. Unlocking (or the lock lapsing) while players are still in their grace period cancels the kick
   and tells them the floor is open again (`reopened`).

**Admin API** (game server, [`server/floorAdmin.ts`](../server/floorAdmin.ts))

| Request                               | Body                      | Answer                                                                                      |
| ------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------- |
| `GET /admin/floors/:floor`            |                           | `{floor, locked, holder?, since?, expiresAt?}`                                              |
| `POST /admin/floors/:floor/lock`      | `{holder, graceSeconds?}` | `200 {locked, holder, since, expiresAt, heartbeatMs, told}` or `409 {error, heldBy, since}` |
| `POST /admin/floors/:floor/heartbeat` | `{holder}`                | `200` or `404` when the caller no longer holds the floor                                    |
| `POST /admin/floors/:floor/unlock`    | `{holder}`                | `200` or `404` when the caller does not hold it                                             |

Access: `Authorization: Bearer $FLOOR_ADMIN_TOKEN` (constant-time comparison). **In production the
API is off unless the token is set**; in development without a token it answers on loopback only.
The same holder asking again continues its session instead of taking a new lock.

**The dev editor** never talks to the game server from the browser: its dev server forwards
`/__editor/floor/*` to `GAME_SERVER_URL` and adds the token, so the token is never in the page.

**Limits, and what to do about each**

- **Without `DATABASE_URL` the locks are in memory**: restarting the game server forgets them (the
  floor opens). With it (Neon Postgres) they are kept in the `floor_locks` table with the same
  expiry, each operation is one atomic statement, and the server runs the pending migrations
  ([`server/db/migrate.ts`](../server/db/migrate.ts)) when it starts. If the database cannot be
  reached the admin API answers 503, and players can still join (a database outage must not lock
  everybody out of the office). Clocks: expiry uses the game server's clock, so several servers
  would need roughly synchronised time. _Instead:_ use the database's own `now()` once there is
  more than one server.
- **Locks are per floor id but the server only knows one floor today.** _Instead:_ nothing to do
  until floors exist; `KNOWN_FLOORS` in `server/floors.ts` is the list to grow.
- **The holder is a name the caller chooses**, not a user. _Instead:_ once there is sign-in, the
  holder is the verified user id and the head role is checked before a lock is granted.
- **Closing the floor is blunt**: everyone is sent out for the whole editing session. _Instead:_
  edit a draft and publish it at a quiet moment, so only the publish needs the floor empty.

## 6. Where layouts live

Today a layout is a source file. For a building it must be stored on the server.

| Option                                | For                                              | Against                                      |
| ------------------------------------- | ------------------------------------------------ | -------------------------------------------- |
| **Database** (Postgres on Railway)    | Versions, audit log, queries, works across hosts | One more service to run                      |
| **Volume with JSON files**            | Nothing new to learn; easy to back up            | One host only; no history unless we build it |
| **Keep it in git, publish by commit** | History for free, reviewable                     | Heads would need git; deploy per change      |

_Recommended:_ a database with **versions** (every publish is a row; the current one is a pointer),
so a bad layout is one click from being undone. The shape is the one `shared/officeFile.ts` already
writes, serialised as JSON.

**Done:** the version store exists. `floor_layouts` keeps one row per published version (never
edited); the current layout is the newest; going back to an earlier one publishes it again as a new
version, so history is never rewritten. Admin API (same token as the lock), in
[`server/layoutAdmin.ts`](../server/layoutAdmin.ts):

| Request                                       | Body                          | Answer                                         |
| --------------------------------------------- | ----------------------------- | ---------------------------------------------- |
| `GET /admin/floors/:floor/layout`             |                               | the current layout, or 404 when none is stored |
| `POST /admin/floors/:floor/layout`            | `{author, furniture, models}` | `{version, dropped, problems[]}`               |
| `GET /admin/floors/:floor/layout/versions`    |                               | `{versions}` newest first, without contents    |
| `GET /admin/floors/:floor/layout/versions/:n` |                               | one version in full                            |
| `POST /admin/floors/:floor/layout/revert`     | `{author, version}`           | `{version, revertedTo}`                        |

Only valid entries are stored (the same sanitizers as the file editor); problems (a piece inside a
wall…) are reported and the layout is stored anyway, as the editor allows.

**Publishing needs the floor closed by the publisher.** `POST …/layout` and `…/revert` answer 409
unless the floor is locked and `author` is the lock's holder, so nobody is inside while it changes
and two people cannot publish over each other.

**How the game uses it (done).**

1. `sceneFor(layout)` in [`shared/layout.ts`](../shared/layout.ts) turns any layout into what is
   drawn and what blocks people (the fixed shell plus the layout, malformed entries left out). The
   built-in constants (`BOX_PIECES`, `OFFICE_COLLIDERS`…) are now just `sceneFor` applied to
   `shared/officeData.ts`, which is the **default layout** every build carries.
2. When a game room is created it reads the floor's newest stored version (or uses the default if
   there is none, or the database cannot be reached) and uses its colliders to referee movement.
3. Each player who joins receives a `layout` message (`{version, furniture, models}`) before
   anything else. The client rebuilds the office and the models if the version differs from what it
   drew (`null` is the default) and uses the same colliders for its own movement.
4. A room is created when the first player arrives and disposed when the last one leaves, so a
   layout published while the floor is closed (nobody inside) applies to the next room.
5. The dev editor loads the stored layout when it opens and when you press **Start editing**, and
   **Publish** stores a new version. **Save to file** still writes `officeData.ts`, the default.

**Rooms that were running when a layout is published (done).** Publishing tells every room of the
floor (`refreshFloor`). A room made from an older version stops taking people (`room.lock()`) and,
3 seconds later, sends the ones inside out with code 4004 (`FLOOR_UPDATED_CODE`); the game joins
them again by itself, to a room made from the new layout. In practice this only matters when
somebody stays inside while the floor is being edited (the editor finished before the grace period
ran out), because normally the floor is empty when it is published.

**Layouts with problems (done).** A piece inside a wall, a piece past the walls, and so on: the
server answers 422 with the list (`needsConfirmation`) and stores nothing, unless the request says
`acceptProblems: true`. The editor sends it only after its own confirmation. Going back to a
version that has problems asks the same.

**Known-good versions (API done, buttons not yet).** Anybody who can publish can vouch for a
version, which changes nothing people see (so it needs no lock): `POST …/layout/versions/:n/good`
with `{author}`. The history shows `good`, and `POST …/layout/revert` with `{author, version:
"good"}` goes back to the newest version vouched for, whatever was published after it. Marks are
kept in their own table (`floor_layout_marks`), so a published version is never edited. _Not yet:_
who may vouch is "whoever may publish"; with roles it becomes the floor's head, and the editor
gets buttons for it.

**The file follows the database (done).** The database is the truth and `shared/officeData.ts` is
the default every build carries. **Export published** in the editor (`POST /__editor/export`)
writes the published layout into that file, through the same checks as saving. It asks first, it is
off while editing or with unsaved changes (the page reloads when the file changes), and with
nothing published it says so and writes nothing.

**Limits, and what to do about each**

- **A person who is moved to a new room briefly sees the menu**, because the game goes through
  its connecting state to join again. _Instead:_ keep the 3D scene and show only a short
  "updating…" note while it reconnects.
- **The 3-second grace is fixed**, and the people inside only get the message when they are
  already leaving. _Instead:_ send a banner first (as the floor lock does), with the time left.

## 7. Editing from inside the game

The dev editor is a separate page and a development tool. For heads it becomes part of the game:

- A floor head sees an **Edit this floor** control. It opens the same plan editor (the code under
  `src/editor/` is reused as it is), calls the lock with their identity, and publishes to the
  database instead of writing a file.
- Members never receive the editor code (a separate lazy-loaded bundle) and the server refuses any
  publish without the head role, whatever the client says.
- Every lock and publish goes to an **audit log**: who, which floor, when, what changed (done, see below).

_Instead of editing inside the game_ (smaller first step): keep the editor as a separate internal
page, protected by the same sign-in. It is quicker to build and keeps the game bundle untouched, but
heads leave the game to edit.

## 7b. Bundle, quality and lite mode

- **Chunks.** `vite.config.ts` (`codeSplitting.groups`) puts `three`, `react`, `clerk` and `colyseus` in their own cacheable chunks. `AppEntry` (`src/App/AppEntry.tsx`) lazy-loads either the 3D office (`App`, with Three.js) or the lite screen, wrapped in `ErrorBoundary` + `LoadFailed` (Reload). The menu shell stays static inside `App`. Before: main chunk 874 kB (267 kB gzip). After: entry chunk 33 kB (12 kB gzip); the largest chunk is `three` at 737 kB. The warning limit stays at 800 kB. The total a desktop downloads on first visit is about the same: the gain is caching and not downloading the 3D code on lite devices.
- **Quality.** `src/game/quality.ts` holds the pure parts (profiles, `resolveLevel`, `stepAutoQuality`, `farUpdateDue`); `Game` applies them (pixel ratio, sun shadows, far avatar updates in `RemotePlayers.update`). Auto only goes down (4 s under 30 fps after 3 s of warm-up, frames over 1 s ignored), which is the hysteresis: it cannot flap. The antialias is fixed when the WebGL context is created, so it follows the level at page load only. The choice is `quality` in `settings.ts`.
- **Lite mode.** `src/lite/device.ts` decides (`chooseView`): no WebGL, then touch-only (coarse pointer and no mouse), then width under 768 px; `?view=lite|office` overrides all but no-WebGL. I went for the full version, not the reduced one: `LiteSession` uses the same `network.connect` and `CallController` (audio only, `receiveVideo: false`) as the game, never sends moves, and tunes every remote person at distance 0 (full volume). The UI is `LiteOffice`, reusing `ChatPanel`, `UserList`, `VoiceIndicator` and `CalendarView`.

## 8. Build order

Each step is useful on its own.

1. ✅ Floor lock and the editor's Start/Finish editing.
2. Sign-in and the verified user on the server (`onAuth`).
3. Roles: member, head, admin; check them on lock and publish.
4. Stored layouts with versions; loader with validation and fallback.
5. Several floors: the directory of floors, the room per floor, a way to move between them (a lift).
6. The editor inside the game for heads, with the audit log.
7. Later: shell as data, free angle and height, a 3D preview, round footprints.

## 8b. Several companies

Decided: **one installation per company** (its own game server, database, site and Clerk
application), not one shared by all. The code stays single-company; what differs is the settings.
How to add a company, the settings and the pre-deploy check are in
[COMPANIES.md](COMPANIES.md). Companies that share a LiveKit project need `VOICE_ROOM_PREFIX`, or
their voice rooms would be the same rooms. One shared installation is for later, when there are
dozens of companies.

## 9. Open questions

- Where does rank come from: the company's directory, or a table we maintain?
- Can a member visit any floor, or only their own area's?
- Should voice carry between floors (for example, a lift or lobby), or is each floor private?
- How many floors and people should the first version handle? This decides whether one process is
  enough.
- JIRA (on hold): when it comes back it will be a server-side integration with its own API data and
  a token that never reaches the browser; it is a different mechanism from screen sharing.
