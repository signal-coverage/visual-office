# Visual Office

A first-person 3D virtual office that runs in the desktop browser. Walk around, chat with text,
and talk by voice with whoever is standing near you (volume fades with distance).

Think WorkAdventure, but in 3D.

## Features

- First-person movement (WASD + mouse look, Shift to run) with wall and furniture collisions
- Furniture drawn from a few boxes and cylinders (desks with drawers and monitors, swivel chairs, sofas with cushions, three kinds of plant...), merged into a handful of draw calls; Low quality drops the smallest details
- Multiplayer presence: other people appear as animated avatars with name tags
- Text chat (Enter) with three scopes: everyone, nearby (the people who can hear you, or the ones in your private room) and a direct message to one person. A direct message shows a badge on the chat button, a toast, an optional short beep, and the tab title counts what is waiting; do-not-disturb people still get the message, silently
- Knock (K, or the menu): at a private room's door it tells the people inside, otherwise it tells the person you face within 3 m; one every 5 seconds, never to do-not-disturb people
- Presence status (available, in a meeting, do not disturb, away): a coloured dot on the name tag and in the people list; change it with Z or from the menu. Away comes by itself after 5 minutes without input, and in a meeting while you are in the meeting room, unless you chose something else
- Emotes (wave, clap, raise hand, thumbs up, dance): hold E and press 1 to 5, or use the menu; everybody sees the avatar's arms move and an icon float above the head for 3 seconds
- Interactions: look at a chair, a desk, a bookshelf or a plant within 2.5 m and a hint tells what **F** (or a left click) does. Chairs are opt-in seats: sit down, and get up with F, Space, W A S D or by opening the menu. A computer shows the announcements of the room's floor and a bookshelf lets you read its books; admins (and the head of each floor) set both up from **Content** in the lobby (plain text, https links only; see `docs/BUILDING.md`, 7c)
- Proximity voice chat (M): full volume within 2 m, silent beyond 10 m
- Proximity video (C): a camera replaces the face of whoever is within 6 m (the hair stays on top)
- Microphone meter next to the voice button, read from the sound that is really being sent
- People list (Tab): everybody in the session, or only who is in the room while you are in a private zone
- Private meeting room: inside it everybody hears and sees everybody, and nobody outside does
- Screen sharing (P) onto the wall screen of the meeting room, seen only by the people in the room
- Every player has a chat colour of their own, the same in the chat and in the people list
- Whiteboard in the meeting room: draw on it live, and everybody in the room sees it as it happens
- Sign-in (Clerk): only the people of the company get in; their name comes from their profile, unless an admin lets people choose their own (company setting, off by default)
- Rooms: several floors, one common room everybody may enter, entries for the others, travel from the menu or the map (R)
- Roles: admins and the head of each floor may edit it; admins name the heads from the game
- Moderation: admins, and the head of a floor on their own floor, can mute somebody's microphone, remove them from the office or ban them for a few minutes, from the game menu or the People screen. The server checks it every time; admins cannot be moderated
- Activity log: admins see who did what (moderation, closing and publishing floors, naming heads, company settings) in the **Activity** screen of the lobby
- Room calendars: an admin pastes the iCalendar (ICS) feed of each private room; the room badge then shows what is on now and next, and the **Room calendars** screen of the menu lists the day. Read-only, no OAuth, no booking
- Office editor: move, turn and add furniture and your own models on a plan seen from above, with warnings when something is wrong. Inside the game for heads and admins; on a developer's machine for everybody
- Layouts kept in a database with versions: publish, go back to an earlier one, vouch for a known-good one
- Editing closes the floor: people inside are warned and sent out, nobody enters meanwhile
- Your own 3D models: drop a `.glb` in `public/models/` and add one line, see [docs/MODELING.md](docs/MODELING.md)
- Server-side referee: speed limits and collisions are checked on the server
- Diagnostics panel (F3): FPS, worst frame, GPU, graphics quality in use and server corrections, to find out why it feels slow
- Graphics quality (Esc, Options): Auto, High or Low. Low turns off shadows, caps the resolution at 1x and updates far-away people less often; Auto picks Low on software rendering or after about 4 s of frames under 30 fps, and never goes back up by itself
- Lite mode: a device with no WebGL, a touch-only device or a narrow window gets a lite screen instead of the 3D office: who is online, chat, room calendars and the voice call (listen and mute). No 3D view, no movement, no camera, no screen sharing. `?view=lite` / `?view=office` in the link force one or the other (the office cannot be forced without WebGL)
- Lobby with a name and a character creator in tabs (skin; hair style and colour; facial hair and glasses;
  top, shirt, pants and shoes; headwear and an accessory), with a live 3D preview you can drag round;
  your choice is remembered on this browser
- Automatic reconnection and clear disconnect handling

Desktop browsers only. There is no mobile support.

## Quick start

Requirements: Node.js 24 (LTS) or newer.

```bash
npm install
npm run dev:all
```

Open <http://localhost:5173>, pick a name and enter. Open a second tab (or share the link on your
network) to see another player. A link like `http://localhost:5173/?name=Ana` skips the lobby and
uses the look saved on this browser, or one made from the name.

`dev:all` starts three processes:

| Process | What it is                                    | Port |
| ------- | --------------------------------------------- | ---- |
| `web`   | Vite dev server (the client)                  | 5173 |
| `game`  | Colyseus game server (rooms, positions, chat) | 2567 |
| `voice` | Local LiveKit server (voice only)             | 7880 |

### Voice in development

Voice needs a LiveKit server. `npm run livekit` runs `livekit-server --dev`, looking first in
`tools/livekit/` and then on your `PATH`. Install it from
<https://docs.livekit.io/home/self-hosting/local/> (for example `brew install livekit` on macOS) or
put the binary in `tools/livekit/` (git-ignored). If it is missing, everything else still works and
the voice button simply does not appear. Voice and video share the same call, so both need it.

Use headphones when testing with two tabs on one machine, or you will hear an echo.

## Controls

| Key     | Action                                                                                       |
| ------- | -------------------------------------------------------------------------------------------- |
| Click   | Capture the mouse                                                                            |
| W A S D | Move                                                                                         |
| Shift   | Run                                                                                          |
| Mouse   | Look around                                                                                  |
| Enter   | Open the chat (pick Everyone, Nearby or Direct), then Enter to send (Esc to cancel)          |
| K       | Knock on a private room's door, or on the person you face                                    |
| F       | Use what you look at (sit, read, look); when seated, get up (Space and W A S D too)          |
| Click   | Same as F on what you look at, except at a whiteboard, where it draws                        |
| Z       | Change your status (available, in a meeting, do not disturb, away)                           |
| E + 1–5 | Hold E and press a number: wave, clap, raise hand, thumbs up, dance                          |
| R       | Map of the rooms: grey plans, colour and name on the ones you may enter (more than one room) |
| Tab     | Show / hide the people list                                                                  |
| Click   | At a whiteboard: hold to draw. 1–7 choose the pen (7 is the eraser), Backspace clears        |
| F3      | Show / hide the diagnostics panel (also `?debug` in the link)                                |
| M       | Join voice, then mute / unmute                                                               |
| C       | Camera on / off. If you are not in the call yet, joins it with the microphone **off**        |
| Esc     | Release the mouse and open the menu (character, controls, options, leave)                    |

## Scripts

| Script                                                   | What it does                                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev:all`                                        | Client + game server + local LiveKit                                                                                                              |
| `npm run dev`                                            | Client only                                                                                                                                       |
| `npm run server`                                         | Game server with auto-reload                                                                                                                      |
| `npm start`                                              | Game server for production (`node server/index.ts`)                                                                                               |
| `npm run livekit`                                        | Local LiveKit server in dev mode                                                                                                                  |
| `npm test`                                               | Unit tests (Vitest)                                                                                                                               |
| `npm run lint`                                           | ESLint                                                                                                                                            |
| `npm run format`                                         | Prettier: rewrite the files, then check them                                                                                                      |
| `npm run build`                                          | Type-check and build the client into `dist/`                                                                                                      |
| `npm run invite -- --dry-run`                            | Shows (or, without `--dry-run`, sends) the invitation for the first admin: sign-up is by invitation only ([docs/COMPANIES.md](docs/COMPANIES.md)) |
| `npm run check:company -- --server <file> --site <file>` | Looks over one company's settings before deploying it ([docs/COMPANIES.md](docs/COMPANIES.md))                                                    |

## Git hooks

[Husky](https://typicode.github.io/husky/) installs them automatically on `npm install`, with the
same setup as the play-padel project.

| Hook         | Runs                                                                   |
| ------------ | ---------------------------------------------------------------------- |
| `pre-commit` | `npm run lint`, `npx tsc -b`, `npx prettier --check .`, `npm run test` |
| `pre-push`   | `npm run build`                                                        |

A commit or push is rejected when any step fails (about 10 seconds for a commit). To get past a
hook in an emergency, use `git commit --no-verify` or `git push --no-verify`.

The type check is `tsc -b` rather than `tsc --noEmit`: `tsconfig.json` only holds project
references, so `tsc --noEmit` on its own would check nothing here. The `prepare` script also
tolerates a missing Husky, so `npm ci --omit=dev` (the production install in the `Dockerfile`)
does not fail.

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to `main` and `develop`,
on every pull request, and on demand from the Actions tab. Hooks can be skipped with
`--no-verify`; the CI cannot.

| Job            | What it does                                                        |
| -------------- | ------------------------------------------------------------------- |
| `checks`       | `npm ci`, lint, `tsc -b`, `prettier --check .`, tests and the build |
| `server-image` | Builds the `Dockerfile`, starts it and waits for `GET /health`      |

The second job is what proves the server image really runs. To make both binding, require them in
the repository settings (Branches → branch protection).

## How it is organised

```text
src/            Web client (Vite + React + Three.js)
  App/            Lobby → connecting → online state machine
  components/     ChatPanel, LobbyScreen, AvatarPreview, AppearancePicker, UserList,
                  VoiceIndicator, ZoneIndicator, AuthRoot (sign-in), GameEditor,
                  PeopleAdmin, ClosingBanner
  game/           Three.js scene, controls, collisions, networking, voice
  editor/         The office editor: the page for developers (editor.html) and the
                  one inside the game, which share the same code
  people/         The screen that names floor heads: what it asks the server
server/         Game server (Colyseus): rooms, chat, voice tokens, sign-in, the admin
                  API (floor lock, layouts, people) and the database (db/)
shared/         Code used by both: state schema, office layout and collisions,
                message validation, movement referee, constants
config/         Vite plugins, including the editor's development endpoints
scripts/        Local LiveKit, sample models, and the check of a company's settings
docs/           Modelling guide, the building design, adding a company
```

- **Client → server** messages (`move`, `chat`) are validated in `shared/` before they are used.
- **The office layout** is plain data. The shell (walls, divider, door) is in `shared/layout.ts` and
  everything that stands inside is a list in `shared/officeData.ts`. The client draws it and the
  server uses the same pieces for collisions, so what you can walk through is decided in one place.
- **Movement** is predicted by the client (so it feels instant) and refereed by the server: each
  player has a distance "budget" that tolerates lag bursts but not teleports or speed hacks, and the
  whole path is checked against the layout. An impossible move makes the server answer with the
  real position and the client snaps back. The server also chooses where each player appears.
- **Positions** are synchronised through Colyseus state; chat is sent as messages. The server decides who receives each one (`server/chatRouting.ts`: everybody, the people in earshot or the same private zone, or one person), so a client never chooses recipients. Knocks work the same way (`server/knockRouting.ts`).
- **Looks** are a handful of palette indices (`shared/appearance.ts`), sent when joining and checked
  by the server: anything that is not a valid choice is replaced by a default made from the name.
  Adding a colour is one line in that file; a new style also needs its boxes in
  `src/game/avatarLook.ts` and a label in the picker. A look saved before an option existed stays
  valid (see docs/BUILDING.md, Looks).
  A look can be changed at any time from the in-game menu (Esc): the server checks it, applies it
  to the player and everybody else sees the avatar change at once. Signed-in people get their last
  look back on the next visit (`users.appearance`); the rule for who may change it is one function,
  `mayChangeLook` in `server/look.ts`.
- **Status and emotes.** Each player has a `status` in the room state (`shared/presence.ts`). The
  client sends what it chose (`status`) and whether it went quiet (`idle`, after `IDLE_AFTER_MS`
  without input); the server decides what everybody sees (`effectiveStatus`: a choice other than
  available is kept, otherwise busy in a private zone, away when idle). `status` is checked against
  the fixed list and has a 400 ms cooldown; who may change it is one function, `mayChangeStatus` in
  `server/presence.ts`. Emotes (`shared/emotes.ts`) are a fixed list: the server validates the
  `emote` message, limits it to one a second and broadcasts `{id, emote}`; the client moves the arms
  (`src/game/emotePose.ts`) and floats an icon for 3 seconds.
- **Voice and video** go through LiveKit. The game server only issues a short-lived token per
  player; each participant's identity is their game session id, so media streams map one to one to
  avatars. Distances are re-evaluated five times a second: audio volume fades with distance, and
  video is only subscribed to for people within 6 m (and kept until 8 m), which saves bandwidth.

### Office editor

Run `npm run dev` and open <http://localhost:5173/editor.html>: the office seen from above (north
is at the top), where you can put furniture and your own models where you want them.

| Do this                        | To                                                        |
| ------------------------------ | --------------------------------------------------------- |
| Pick from the left, then click | Put a new piece down (Esc to stop; Esc again to deselect) |
| Click a piece, drag it         | Select it and move it (the right panel shows x and z)     |
| **R**                          | Turn the selected piece a quarter turn                    |
| **Delete**                     | Remove it                                                 |
| **Ctrl+D**                     | Copy it                                                   |
| Arrow keys                     | Nudge it by the snap size (5, 25 or 50 cm, at the top)    |
| **Ctrl+Z**, **Ctrl+Y**         | Undo and redo (a whole drag is one step)                  |
| **Ctrl+S** or the Save button  | Write the layout                                          |

What stands inside the office lives in [`shared/officeData.ts`](shared/officeData.ts): a list of
furniture (kinds in [`shared/furniture.ts`](shared/furniture.ts)) and a list of your `.glb` models.
**Save** rewrites that file, formatted by Prettier and with only valid entries. In development the
game server and the page reload by themselves. To put a layout in production, commit the file and
deploy, like any code change.

The right panel lists **problems** while you edit: a piece past a wall, inside a wall, on top of
another, where people appear, or closing off the meeting room. They do not stop you from saving,
but **Save asks you to confirm** when there are any, and the game server prints the same list when
it starts. The walls, the divider and its door, the whiteboard and the screen are fixed, because
zones, boards and screens depend on where they are.

**Upload a model…** (under _Your models_) copies a `.glb` from your computer into `public/models/`
and lets you place it at once. The name is tidied (spaces become dashes), the file must really be a
glTF 2.0 binary under 20 MB, and a model that already has that name is only replaced if you say so.

The **page** `editor.html` and the endpoints it uses (save, upload, the list of models, forwarding to
the game server) exist only under `npm run dev`: the production build contains none of them, and
they only answer on `localhost`. **Inside the game** the same editor is offered to the heads of a
floor and to admins (button _Edit this floor_ in the lobby), talking to the game server with their
sign-in; it leaves out what writes files (upload, Save to file, Export). See
[docs/BUILDING.md](docs/BUILDING.md).

**Save to file or Publish.** _Save to file_ (Ctrl+S) rewrites `shared/officeData.ts`, the default
layout every build carries. _Publish_ stores the layout in the database (needs `DATABASE_URL` and the
floor closed by you) as a new version; the game shows the newest published version, and falls back
to the default when there is none. The editor opens with the published version, if there is one.
The server refuses to publish a layout with problems unless they are accepted (the editor asks
first). **Export published** goes the other way: it writes the published layout into
`shared/officeData.ts`, so the file follows the database. If somebody is still inside when a new
version is published, their game joins again by itself, to a room built from it.

**Editing closes the floor.** The plan starts read only. **Start editing** asks the game server to
lock the floor: everybody inside gets a banner counting down (10 s) and is then sent back to the
menu, and nobody can join until you press **Finish editing** (or close the tab, or the editor goes
silent for 45 s, which also releases it). If the game server cannot be reached the editor asks
whether to edit anyway, which is only safe when nobody is playing. If somebody else holds the
floor, the editor says who. See [docs/BUILDING.md](docs/BUILDING.md) for the design and the API.

Its limits, and what to do about each:

- **Pieces turn only by quarter turns and stand on the floor**, so a lamp cannot sit on a desk.
  _Instead (planned):_ give a piece a height and a free angle; the collision box of a turned model
  is already the box that encloses it.
- **The walls, the divider, the whiteboard and the screen cannot be moved.** _Instead (planned):_
  describe them as data too; zones, boards and screens would then follow wherever they are put.
- **No 3D preview.** _Instead (for later):_ keep the game open in another tab, or add a small 3D
  view to the editor.
- **A model's footprint is a rectangle measured from its bounding box**, so a round table or a
  curved sofa blocks more floor than it should. _Instead (for later):_ type the width and depth in
  the right panel to get close now; a proper answer is round and polygon footprints.
- **Only one editor at a time, and editing sends everybody out.** The floor lock makes it so on
  purpose: nobody is inside while the plan changes, and two editors cannot overwrite each other.
  _Instead (planned):_ edit a draft while the floor stays open, and publish it at a scheduled
  quiet moment.
- **All floors share the same shell and zones.** Floors are in the database, each with its own
  layout, lock, heads and voice, but walls, divider, whiteboard and screen are code. _Instead
  (planned):_ the shell as data. There is a list of rooms in the menu; the map comes later.

#### Moderation and the activity log

- **Who may:** `canModerate` / `mayModerate` in [`server/moderation.ts`](server/moderation.ts): admins, and the head of that floor. Nobody acts on themselves, and nobody acts on an admin. Roles are looked up on the server on every action.
- **Mute** takes the microphone away through LiveKit's server API (`updateParticipant` removes the microphone from what the person may publish, and a microphone already on is muted). It lasts until they leave the office; the tokens the server issues meanwhile carry no microphone. **Let speak** gives it back.
- **Remove** closes the person's connection with code 4005 and the message _"You were removed from the office by a moderator."_; the game does not join again by itself. **Ban** (1 to 240 minutes, 10 by default) also refuses them at the door (`onAuth`, code 4006) by their account id until it ends.
- It is also reachable from outside the game: `POST /admin/moderation` with `{action, userId, minutes?}`.
- **Activity log:** table `audit_log` ([`server/auditStore.ts`](server/auditStore.ts), memory and Postgres), read with `GET /admin/audit?limit=&before=` (admins only, newest first, up to 200 per page). The app never edits or deletes it.

_Limits:_ bans are kept in memory, so a server restart forgets them, and they are for signed-in people only (without sign-in nobody can moderate). The log has no retention: it only grows. _Instead:_ a `bans` table with the same memory/Postgres pattern, and a scheduled `DELETE FROM audit_log WHERE at < ...` (or one partition per month) run from the database provider.

#### The building

The app is a building for a company: **each floor is one area's office** (marketing, sales,
development…), and only its head, or an admin, can edit it. Sign-in, roles, stored layouts with
versions, the floor lock and the editor inside the game exist, and so do **several floors**: an
admin makes rooms (lobby, _Rooms_), says who may enter each (_People_, "Can enter"), everybody can
enter the common room, and people travel from the Esc menu (_Rooms_). Each
company has its own installation ([docs/COMPANIES.md](docs/COMPANIES.md)). The full design is in
[docs/BUILDING.md](docs/BUILDING.md).

### Private zones

The meeting room (east of the divider) is a private zone, defined in [`shared/zones.ts`](shared/zones.ts)
from the same layout that draws the room. While you are inside:

- you hear and see **everybody in the room at full volume, however far** (the room is longer than
  the 10 m proximity limit), and a green "Private zone" badge is shown;
- people outside cannot hear or see you, and you cannot hear or see them.

Privacy is enforced by the **server**, not by the client being polite: each zone has its own LiveKit
room (`office` for the open plan, `office-meeting` for the meeting room). The server tracks where each
player stands from the moves it has already refereed and sends credentials for the right room; the
token only lets that player into that one room. A modified client therefore cannot just ask for the
meeting room, it has to be inside it.

### Screen sharing

In the meeting room press **P**: the browser asks what to share (a screen, a window or a tab) and
the picture appears on the screen on the north wall, for everybody in the room. Press **P** again,
or use the browser's own "stop sharing" button, to stop. If you are not in the call yet, **P** joins
it with your microphone off.

- It travels as video through the room's own LiveKit call, so people outside the room never receive
  it, and the server's token only allows publishing a screen in a private room: a modified client
  that tries it in the open office is refused by LiveKit.
- Only people **in the call** receive it. Walking into a room with a screen while not in the call
  shows a notice saying to press **M**, **C** or **P**, and the wall screen reads "Join the call to
  see shared screens" instead of "No screen shared", which would be untrue.
- One screen shows at a time: the one that started last, and the one before when it stops. You see
  "You are sharing your screen" instead of your own picture, to avoid a mirror-in-a-mirror effect.
- It shares the picture only, not the sound.
- It is sent at up to 1920×1080 but only 10 frames a second, which favours readable text over smooth
  motion. It is the heaviest thing here for LiveKit's free quota, because every viewer receives it;
  how much it really uses has not been measured.
- The browser may release the mouse while its picker is open: click the view to capture it again.

### Whiteboards

Stand in the meeting room within about 3.5 m of the whiteboard on the east wall and look at it: a
pen cursor and a hint appear. Hold the left mouse button to draw, **1–7** pick the pen (7 is the
eraser), **Backspace** wipes the whole board for everybody in the room. Boards are defined in
[`shared/boards.ts`](shared/boards.ts); a board belongs to a private zone.

- Strokes go through the game server, which checks that you are in the board's zone and within
  reach, limits how fast you can send (a burst, then 30 messages a second), and sends them **only to
  the people in that zone**. Somebody who walks in gets what is already on the board; when you walk
  out, your screen forgets it.
- The server keeps each board in memory: it is there until somebody clears it or the server
  restarts, so it is shared across meetings. A board holds up to 60,000 points; when it is full,
  drawing stops until it is cleared.
- Erasing is drawing in white: it is stored and sent like any other stroke.
- Clearing is for everybody in the room, with no undo and no confirmation.
- A board is only a drawing surface for now. Showing a shared screen or a Jira board on one would
  reuse the same plane.

Things worth knowing about private zones:

- Crossing the door moves your call to another room, so expect a gap of about a second. Your
  microphone and camera state is kept. Changes are spaced at least 1 s apart, so wobbling in the
  doorway does not reconnect you over and over; the zone itself changes with a margin of 35 cm on each
  side of the wall for the same reason.
- Tokens for a private room expire after 2 minutes. A token is only needed to join, so this stops a
  stale one from letting somebody back in after they left.
- After walking out, a player's own client moves them to the other room (about a second). If a
  modified client refuses, the server removes it: every 5 seconds it lists who is in each private
  room and removes (LiveKit's `removeParticipant`) anybody it did not send there. So the worst case
  is a few seconds of staying in the call, and the same sweep catches someone who rejoins with an old
  token. Only players of that game room are touched, and the open office is never swept: being in it
  reveals nothing of what is said in a private room.
- If the call drops (network, or the server removes you), the voice button says "Call failed · M:
  retry" instead of keeping "Mic on".
- Client and server must be deployed together. A page from before this feature never moves to the
  private room, so it simply does not hear (or get heard in) the meeting room; reload the page.
- **Text chat** has scopes (everyone, nearby, direct); direct messages reach only the sender and the target. Messages are not stored: whoever joins later sees none of them.
- Adding a zone is one entry in `ZONES`; the client and the server pick it up from there.

### Room calendars

Each private room can show what is happening in it. There is **no OAuth and no Google or Microsoft API**: an admin pastes an iCalendar (ICS) feed address per room in the lobby's **Calendars** screen (Google Calendar: "Secret address in iCal format"; Outlook: a published calendar). Details and limits in [docs/BUILDING.md](docs/BUILDING.md).

- Server: [`server/ics.ts`](server/ics.ts) (parser), [`server/calendarFetch.ts`](server/calendarFetch.ts) (fetcher with SSRF protection), [`server/calendarService.ts`](server/calendarService.ts) (storage in `settings` as `calendar_feed:<room>`, 5-minute cache), `GET|POST /admin/calendars` (admins) and `GET /calendar` (members: titles and times only, never the address).
- Client: a one-line badge under the zone badge, the **Room calendars** item of the Esc menu, and the admin screen; both screens are lazy-loaded.
- For tests only, `CALENDAR_ALLOW_LOCAL_FOR_TESTS=1` lets a feed be plain http on this machine; it is ignored when `NODE_ENV=production`.

## Configuration

| Variable                     | Where                                   | Purpose                                                                                                                                                                                                                                                                                |
| ---------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SERVER_URL`            | Client, **build time**                  | URL of the game server, e.g. `wss://office-server.example.com`. Required for production builds. Defaults to `ws://<current host>:2567` in development only.                                                                                                                            |
| `PORT`                       | Game server                             | Port to listen on. Defaults to `2567`.                                                                                                                                                                                                                                                 |
| `LIVEKIT_URL`                | Game server                             | LiveKit WebSocket URL, e.g. `wss://your-project.livekit.cloud`.                                                                                                                                                                                                                        |
| `LIVEKIT_API_KEY`            | Game server                             | LiveKit API key.                                                                                                                                                                                                                                                                       |
| `LIVEKIT_API_SECRET`         | Game server                             | LiveKit API secret.                                                                                                                                                                                                                                                                    |
| `FLOOR_ADMIN_TOKEN`          | Game server, dev server                 | Secret for the floor admin API (`/admin/floors/…`, sent as `Authorization: Bearer`). **Required in production**: without it the API is off there. In development it is optional (the API then answers only on loopback). The dev editor forwards it if it is set. Never in the client. |
| `DATABASE_URL`               | Game server                             | Postgres connection string (Neon gives one). Optional: with it the floor locks live in the database and survive restarts; without it they live in memory. Tables are created on start. Never in the client, never in git.                                                              |
| `CLERK_SECRET_KEY`           | Game server                             | Clerk secret key (`sk_…`). With the publishable key, turns sign-in on: the server refuses people without a valid token. Never in the client.                                                                                                                                           |
| `VITE_CLERK_PUBLISHABLE_KEY` | Client, **build time**, and game server | Clerk publishable key (`pk_…`). Must come from the same Clerk instance as the secret key (test and live differ). The server prints whether both look right at startup, never the keys.                                                                                                 |
| `ALLOWED_ORIGINS`            | Game server                             | Comma separated sites that may call the admin API from a browser (the editor inside the game), e.g. `https://office.example.com`. Pages from this machine are allowed in development. Required in production for the editor inside the game.                                           |
| `FLOOR_ADMIN_TOKEN` (people) | Game server                             | With sign-in on, the admin API also accepts a person's Clerk token: admins and floor heads may close and edit their floors. The token above is only for the server's own tools.                                                                                                        |
| `VOICE_ROOM_PREFIX`          | Game server                             | A short name put in front of every voice room (`acme` gives `acme-office`). Needed when several companies share one LiveKit project; without it they would share the same rooms.                                                                                                       |
| `CLERK_ORGANIZATION_ID`      | Game server                             | Optional. The Clerk organization that is the company: only its members may enter. Without it, the first admin (`ADMIN_EMAILS`) creates the organization from the game and the server saves it.                                                                                         |
| `ADMIN_EMAILS`               | Game server                             | Comma separated emails that become admins on first sign-in (verified emails only).                                                                                                                                                                                                     |
| `CLERK_AUTHORIZED_PARTIES`   | Game server                             | Optional, comma separated origins a sign-in token may come from (e.g. `https://office.example.com`).                                                                                                                                                                                   |
| `GAME_SERVER_URL`            | Dev server (editor)                     | Where the editor finds the game server to lock the floor. Defaults to `http://localhost:2567`.                                                                                                                                                                                         |

The `LIVEKIT_*` variables fall back to the `livekit-server --dev` credentials (`devkey` / `secret`)
**only outside production**. With `NODE_ENV=production` and no variables set, voice is turned off
instead of running with well-known secrets.

Voice is the one setting that fails quietly when it is wrong, so the server states how it came out
in its startup log (the credentials are never printed):

```text
Voice chat is on, using wss://your-project.livekit.cloud
Voice chat is off: missing LIVEKIT_API_SECRET
Voice chat is off: set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET to turn it on
```

`LIVEKIT_URL` may be written as `https://…`, `wss://…` or without a scheme; it is converted to the
`wss://` form the browser needs. Spaces or line breaks pasted around any value are ignored, and an
empty variable counts as not set.

## Deploying

The app has three independent pieces:

1. **Web client** — static files. Run `VITE_SERVER_URL=wss://… npm run build` and host `dist/` on any
   static host (Vercel, Netlify, Cloudflare Pages…). `VITE_SERVER_URL` is baked in at build time, so
   it must be set in the host's build environment.
2. **Game server** — needs a long-lived process with WebSocket support (Fly.io, Railway, Render, a
   VPS…). Rooms live in the memory of that process, so it does **not** fit serverless functions. A
   `Dockerfile` is included; it listens on `PORT` and answers `GET /health`. Serve it over TLS so
   the client can use `wss://`.
3. **Voice and video** — [LiveKit Cloud](https://livekit.com/pricing) or your own LiveKit server.
   Put its URL and keys in the game server's environment (never in the client, and never in git).
   LiveKit Cloud's free Build plan listed 5,000 WebRTC minutes, 50 GB of downstream data and 100
   concurrent connections when this was written; video is what uses the bandwidth, audio is cheap.
   Check your dashboard for what happens when a quota runs out.

## Known limitations

Each one comes with a way around it.

- **The server referees movement, but does not simulate it.** It rejects teleports, speed hacks and
  walking through furniture, yet a modified client can still run at the maximum allowed speed in
  any legal direction, lie about where it is looking, and walk through other avatars (players do
  not collide with each other).
  _Instead:_ make the server move people from their key presses (authoritative movement), which
  closes all three at the cost of server work and a little lag handling; or, cheaper, make the
  referee also reject positions inside another player.
- **Video is basic**: one fixed quality (480×360, 24 fps), and the camera is cropped to a square
  and shown on a head-sized screen, so it gets hard to read from several metres.
  _Instead:_ turn on LiveKit's simulcast so each viewer receives the size it needs, and ask for the
  high quality only from the people who are close; or make the face larger.
- **The office shell is built from boxes and the avatars are procedural.** Individual objects can
  already be your own models (see [docs/MODELING.md](docs/MODELING.md)).
  _Instead:_ model the whole office as one `.glb` and keep `shared/layout.ts` as invisible
  collision boxes, which is what the server uses anyway; or use a style-consistent pack
  (Kenney, Quaternius) for the furniture.
- **Models are static**: no animations, and no interaction with them yet.
  _Instead:_ play a model's own animations (Three.js `AnimationMixer`) for decoration, and add a
  "press E to use" action for things people should interact with (a door, a TV).
- **One shared office.** Everyone joins the same room until it is full (30 players), then a second
  room is created and people in different rooms cannot see each other.
  _Instead:_ let people pick a room by name at the menu (Colyseus can filter by it), so a team
  always lands together; raising `maxClients` is limited by LiveKit's 100 concurrent connections
  on the free plan.
- **No persistence**: restarting or redeploying the game server empties the office, including what
  is drawn on the whiteboard.
  _Instead:_ keep the boards in a small database or a volume on the server (Railway offers both),
  or add a button that saves a board as an image before a meeting ends.
- Three.js (~737 kB, 187 kB gzip) is the largest part of the first load. LiveKit (~520 kB) is only downloaded
  when someone joins the call. The build splits stable vendor code (react, clerk, colyseus, three)
  into their own cacheable chunks and the 3D office and the lite screen are separate lazy chunks:
  no chunk is over the 800 kB warning limit, but a desktop visit still downloads about the same
  total as before (the split helps caching and lite devices, not the first desktop load).
  _Instead:_ nothing is needed yet: all are cached after the first visit, and the host already
  compresses them.
- **Lite mode is not the office.** It connects to the same room but never moves: the person stays
  where new arrivals appear, so the "nearby" chat and what others hear of their voice come from
  that spot, and they hear everybody in the open office at full volume. The chat is opened with its
  button; typing Enter on some phone keyboards has not been tested on a real device.
  _Instead:_ a touch-friendly 3D control scheme (virtual joystick) would give mobile the real office.
