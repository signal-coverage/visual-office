# Visual Office

A first-person 3D virtual office that runs in the desktop browser. Walk around, chat with text,
and talk by voice with whoever is standing near you (volume fades with distance).

Think WorkAdventure, but in 3D.

## Features

- First-person movement (WASD + mouse look, Shift to run) with wall and furniture collisions
- Multiplayer presence: other people appear as animated avatars with name tags
- Text chat (Enter)
- Proximity voice chat (M): full volume within 2 m, silent beyond 10 m
- Proximity video (C): a camera feed floats above the avatar of whoever is within 6 m
- Private meeting room: inside it everybody hears and sees everybody, and nobody outside does
- Your own 3D models: drop a `.glb` in `public/models/` and add one line, see [docs/MODELING.md](docs/MODELING.md)
- Server-side referee: speed limits and collisions are checked on the server
- Diagnostics panel (F3): FPS, worst frame, GPU and server corrections, to find out why it feels slow
- Lobby with a name, automatic reconnection and clear disconnect handling

Desktop browsers only. There is no mobile support.

## Quick start

Requirements: Node.js 24 (LTS) or newer.

```bash
npm install
npm run dev:all
```

Open <http://localhost:5173>, pick a name and enter. Open a second tab (or share the link on your
network) to see another player. A link like `http://localhost:5173/?name=Ana` skips the lobby.

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

| Key     | Action                                                                                |
| ------- | ------------------------------------------------------------------------------------- |
| Click   | Capture the mouse                                                                     |
| W A S D | Move                                                                                  |
| Shift   | Run                                                                                   |
| Mouse   | Look around                                                                           |
| Enter   | Open the chat, then Enter to send (Esc to cancel)                                     |
| F3      | Show / hide the diagnostics panel (also `?debug` in the link)                         |
| M       | Join voice, then mute / unmute                                                        |
| C       | Camera on / off. If you are not in the call yet, joins it with the microphone **off** |
| Esc     | Release the mouse                                                                     |

## Scripts

| Script            | What it does                                        |
| ----------------- | --------------------------------------------------- |
| `npm run dev:all` | Client + game server + local LiveKit                |
| `npm run dev`     | Client only                                         |
| `npm run server`  | Game server with auto-reload                        |
| `npm start`       | Game server for production (`node server/index.ts`) |
| `npm run livekit` | Local LiveKit server in dev mode                    |
| `npm test`        | Unit tests (Vitest)                                 |
| `npm run lint`    | ESLint                                              |
| `npm run format`  | Prettier: rewrite the files, then check them        |
| `npm run build`   | Type-check and build the client into `dist/`        |

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
  components/     ChatPanel, LobbyScreen, VoiceIndicator, ZoneIndicator
  game/           Three.js scene, controls, collisions, networking, voice
server/         Game server (Colyseus): rooms, chat, voice tokens
shared/         Code used by both: state schema, office layout and collisions,
                message validation, movement referee, constants
```

- **Client → server** messages (`move`, `chat`) are validated in `shared/` before they are used.
- **The office layout** (`shared/layout.ts`) is plain data. The client draws it and the server uses
  the same pieces for collisions, so what you can walk through is decided in one place.
- **Movement** is predicted by the client (so it feels instant) and refereed by the server: each
  player has a distance "budget" that tolerates lag bursts but not teleports or speed hacks, and the
  whole path is checked against the layout. An impossible move makes the server answer with the
  real position and the client snaps back. The server also chooses where each player appears.
- **Positions** are synchronised through Colyseus state; chat is broadcast as messages.
- **Voice and video** go through LiveKit. The game server only issues a short-lived token per
  player; each participant's identity is their game session id, so media streams map one to one to
  avatars. Distances are re-evaluated five times a second: audio volume fades with distance, and
  video is only subscribed to for people within 6 m (and kept until 8 m), which saves bandwidth.

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

Things worth knowing:

- Crossing the door moves your call to another room, so expect a gap of about a second. Your
  microphone and camera state is kept. Changes are spaced at least 1 s apart, so wobbling in the
  doorway does not reconnect you over and over; the zone itself changes with a margin of 35 cm on each
  side of the wall for the same reason.
- Tokens for a private room expire after 2 minutes. A token is only needed to join, so this stops a
  stale one from letting somebody back in after they left.
- After walking out, a player's own client moves them to the other room (about a second). If a
  modified client refuses, the server removes it: every 5 seconds it lists who is in each voice room
  and removes (LiveKit's `removeParticipant`) anybody it did not send there. So the worst case is a
  few seconds of staying in the call, and the same sweep catches someone who rejoins with an old
  token. Only players of that game room are touched.
- **Text chat is not private**: it is still broadcast to everyone.
- Adding a zone is one entry in `ZONES`; the client and the server pick it up from there.

## Configuration

| Variable             | Where                  | Purpose                                                                                                                                                     |
| -------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SERVER_URL`    | Client, **build time** | URL of the game server, e.g. `wss://office-server.example.com`. Required for production builds. Defaults to `ws://<current host>:2567` in development only. |
| `PORT`               | Game server            | Port to listen on. Defaults to `2567`.                                                                                                                      |
| `LIVEKIT_URL`        | Game server            | LiveKit WebSocket URL, e.g. `wss://your-project.livekit.cloud`.                                                                                             |
| `LIVEKIT_API_KEY`    | Game server            | LiveKit API key.                                                                                                                                            |
| `LIVEKIT_API_SECRET` | Game server            | LiveKit API secret.                                                                                                                                         |

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

- **The server referees movement, but does not simulate it.** It rejects teleports, speed hacks and
  walking through furniture, yet a modified client can still run at the maximum allowed speed in
  any legal direction, lie about where it is looking, and walk through other avatars (players do
  not collide with each other).
- **Video is basic**: one fixed quality (480×360, 24 fps), no screen sharing, and the feed is a
  floating panel above the avatar, not a face.
- **The office shell is built from boxes and the avatars are procedural.** Individual objects can
  already be your own models (see [docs/MODELING.md](docs/MODELING.md)); a fully modelled office
  would replace the drawing in `src/game/office.ts` while `shared/layout.ts` keeps describing where
  players can and cannot stand, because the server uses that file for collisions, not the model.
- **Models are static**: no animations, and no interaction with them yet.
- **One shared office.** Everyone joins the same room until it is full (30 players), then a second
  room is created and people in different rooms cannot see each other.
- **No persistence**: restarting the game server empties the office.
- Three.js (~540 kB) is the largest part of the first load. LiveKit (~520 kB) is only downloaded
  when someone joins the call.
