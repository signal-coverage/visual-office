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

### Looks and the in-game menu

Esc (or the **Menu** button) releases the mouse and opens the menu: your character, the controls,
options and leaving the office. The look is edited live: the client sends `appearance`, the server
sanitises it (`nextLook`), applies a 400 ms cooldown and updates the player, so the other clients
rebuild that avatar. Who may change it is decided in one place, `mayChangeLook` in
`server/look.ts` (everybody, for now). Signed-in people keep their last look in
`users.appearance` (migration `007_user_appearance`), returned by `GET /account/session`; others
keep it in the browser. Options (mouse sensitivity, key hints) live in the browser only
(`visual-office:settings`).

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
- Every lock and publish goes to an **audit log**: who, which floor, when, what changed.

_Instead of editing inside the game_ (smaller first step): keep the editor as a separate internal
page, protected by the same sign-in. It is quicker to build and keeps the game bundle untouched, but
heads leave the game to edit.

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
