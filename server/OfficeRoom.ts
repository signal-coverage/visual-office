import { Room, ServerError, type Client } from "colyseus";
import {
  CHAT_COOLDOWN_MS,
  sanitizeChat,
  type ChatMessage,
} from "../shared/chat.ts";
import {
  defaultAppearance,
  sanitizeAppearance,
  type Appearance,
} from "../shared/appearance.ts";
import { refusalFor } from "../shared/auth.ts";
import { lowestFreeColor } from "../shared/chatColor.ts";
import { MAX_PLAYERS_PER_ROOM, SPAWN } from "../shared/constants.ts";
import {
  FLOOR_CLOSED_CODE,
  FLOOR_CLOSED_MESSAGE,
  FLOOR_ID,
  FLOOR_UPDATED_CODE,
  FLOOR_UPDATED_MESSAGE,
  type ClosingMessage,
  type LayoutMessage,
} from "../shared/floors.ts";
import { sceneFor, type FloorScene } from "../shared/layout.ts";
import { OFFICE_FURNITURE, OFFICE_MODELS } from "../shared/officeData.ts";
import { sanitizeMove, type Correction } from "../shared/movement.ts";
import { MovementValidator } from "../shared/movementValidator.ts";
import { sanitizeName } from "../shared/name.ts";
import { randomSpawn } from "../shared/spawn.ts";
import { OfficeState, Player } from "../shared/state.ts";
import type { VoiceCredentials } from "../shared/voice.ts";
import { ZONES, zoneAt, type ZoneMessage } from "../shared/zones.ts";
import {
  createVoiceAdmin,
  createVoiceToken,
  voiceConfigFromEnv,
} from "./voice.ts";
import { authenticateJoin, users } from "./auth.ts";
import { BoardService } from "./boardService.ts";
import { floorLocks, layouts, registerRoom } from "./floors.ts";
import { mayChangeLook, nextLook, waitedEnough } from "./look.ts";
import { enforceZones } from "./zoneEnforcer.ts";
import type { UserRecord } from "./userStore.ts";
import { ZoneSwitcher } from "./zoneSwitcher.ts";

const voiceConfig = voiceConfigFromEnv(process.env);

/** Minimum time between two moves of somebody's call from one voice room to another. */
const VOICE_SWITCH_GAP_MS = 1000;
/** How long people have between a new layout being published and being sent to join again. */
const LAYOUT_UPDATE_GRACE_MS = 3000;
/** How often to remove from a voice room whoever the server did not send there. */
const ENFORCE_INTERVAL_MS = 5000;

export class OfficeRoom extends Room<{ state: OfficeState }> {
  maxClients = MAX_PLAYERS_PER_ROOM;
  private readonly lastChatAt = new Map<string, number>();
  private readonly lastLookAt = new Map<string, number>();
  /** Who each signed-in player is, by session: what their look is saved for. */
  private readonly members = new Map<string, UserRecord>();
  private readonly referees = new Map<string, MovementValidator>();
  private readonly zones = new Map<string, string | null>();
  private readonly switchers = new Map<string, ZoneSwitcher>();
  private boards!: BoardService;
  private forgetFloor: (() => void) | null = null;
  /** What stands in this floor, and so what blocks people. */
  private scene: FloorScene = sceneFor({
    furniture: OFFICE_FURNITURE,
    models: OFFICE_MODELS,
  });
  /** The stored version this room was made from, or null for the default. */
  private layoutVersion: number | null = null;

  /**
   * Who may enter: nobody while the floor is being edited, and, when sign-in is
   * on, only somebody the sign-in service vouches for. Returns who they are
   * (or true when sign-in is off), which `onJoin` receives.
   */
  async onAuth(_client: Client, options?: { token?: unknown }) {
    let locked = false;
    try {
      locked = (await floorLocks.current(FLOOR_ID)) !== null;
    } catch (error) {
      // A database that cannot be reached must not lock everybody out of the office
      console.error("Could not check whether the floor is closed:", error);
    }
    if (locked) throw new ServerError(FLOOR_CLOSED_CODE, FLOOR_CLOSED_MESSAGE);

    const who = await authenticateJoin(options?.token);
    if (who && !who.ok) {
      const { code, message } = refusalFor(who.reason);
      throw new ServerError(code, message);
    }
    return who ? who.user : true;
  }

  /**
   * The floor is about to be edited: tell everybody here, and send them out
   * when the time is up, unless the editor finished first. Returns how many were told.
   */
  closeForEditing(graceSeconds: number): number {
    const told = this.clients.length;
    if (told === 0) return 0;
    this.broadcast("closing", {
      seconds: graceSeconds,
    } satisfies ClosingMessage);
    this.clock.setTimeout(() => {
      void (async () => {
        // If the database cannot say, the editor did ask for the floor to close: go on
        const stillClosed = await floorLocks
          .current(FLOOR_ID)
          .then((lock) => lock !== null)
          .catch(() => true);
        if (!stillClosed) {
          this.broadcast("reopened");
          return;
        }
        for (const client of [...this.clients])
          client.leave(FLOOR_CLOSED_CODE, FLOOR_CLOSED_MESSAGE);
      })();
    }, graceSeconds * 1000);
    return told;
  }

  /**
   * A new layout was published for this floor. A room made from an older one
   * stops taking people, and sends the ones inside out a moment later; the game
   * joins them again by itself, to a room made from the new layout.
   */
  layoutPublished(version: number): void {
    if (version === this.layoutVersion) return;
    void this.lock();
    this.clock.setTimeout(() => {
      for (const client of [...this.clients])
        client.leave(FLOOR_UPDATED_CODE, FLOOR_UPDATED_MESSAGE);
    }, LAYOUT_UPDATE_GRACE_MS);
  }

  async onCreate() {
    this.state = new OfficeState();

    // What stands in the floor is what was last published, or the default
    // that comes with the build when nothing was (or the database is down)
    try {
      const stored = await layouts.current(FLOOR_ID);
      if (stored) {
        this.scene = sceneFor(stored);
        this.layoutVersion = stored.version;
      }
    } catch (error) {
      console.error(
        "Could not load the floor's layout, using the default:",
        error,
      );
    }
    // Only now, so it is told about layouts from the one it was made from on
    this.forgetFloor = registerRoom(FLOOR_ID, this);

    this.boards = new BoardService({
      zoneOf: (id) => this.zones.get(id) ?? null,
      positionOf: (id) => {
        const player = this.state.players.get(id);
        return player && { x: player.x, z: player.z };
      },
      clientsInZone: (zone) =>
        [...this.zones].filter(([, z]) => z === zone).map(([id]) => id),
      send: (id, type, payload) =>
        this.clients.find((c) => c.sessionId === id)?.send(type, payload),
    });
    this.onMessage("draw", (client, payload) =>
      this.boards.draw(client.sessionId, payload),
    );
    this.onMessage("clearBoard", (client, payload) =>
      this.boards.clear(client.sessionId, payload),
    );

    if (voiceConfig) {
      const admin = createVoiceAdmin(voiceConfig);
      // Only private rooms: being in the open office while standing in a zone
      // reveals nothing of what is said in there, so it is not worth evicting
      const rooms = ZONES.map((zone) => zone.id);
      this.clock.setInterval(() => {
        void enforceZones(
          admin,
          rooms,
          (id) => this.switchers.get(id)?.issuedZone,
          voiceConfig.roomPrefix,
        ).then((evicted) => {
          if (evicted.length)
            console.warn(
              `Removed from a voice room they were not sent to: ${evicted.length}`,
            );
        });
      }, ENFORCE_INTERVAL_MS);
    }

    this.onMessage("move", (client, payload) => {
      const move = sanitizeMove(payload);
      const player = this.state.players.get(client.sessionId);
      const referee = this.referees.get(client.sessionId);
      if (!move || !player || !referee) return;

      if (!referee.validate(move, Date.now()).ok) {
        // The client moves itself for responsiveness; when it disagrees with the
        // server about what is possible, the server wins and the client snaps back.
        client.send("correct", referee.position satisfies Correction);
        return;
      }
      player.x = move.x;
      player.z = move.z;
      player.yaw = move.yaw;
      this.trackZone(client, move.x, move.z);
    });

    // Changing how they look, at any time: the server checks it and everybody sees it
    this.onMessage("appearance", (client, payload) => {
      const player = this.state.players.get(client.sessionId);
      const member = this.members.get(client.sessionId) ?? null;
      if (!player || !mayChangeLook(member)) return;
      const now = Date.now();
      if (!waitedEnough(this.lastLookAt.get(client.sessionId), now)) return;
      const next = nextLook(
        {
          skin: player.skin,
          hairColor: player.hairColor,
          hairStyle: player.hairStyle,
          shirt: player.shirt,
          pants: player.pants,
        },
        payload,
      );
      if (!next) return;
      this.lastLookAt.set(client.sessionId, now);
      Object.assign(player, next);
      if (member) this.saveLook(member.id, next);
    });

    this.onMessage("chat", (client, payload) => {
      const text = sanitizeChat(payload);
      const player = this.state.players.get(client.sessionId);
      if (!text || !player) return;

      const now = Date.now();
      if (now - (this.lastChatAt.get(client.sessionId) ?? 0) < CHAT_COOLDOWN_MS)
        return;
      this.lastChatAt.set(client.sessionId, now);

      const message: ChatMessage = {
        id: client.sessionId,
        name: player.name,
        text,
        at: now,
        color: player.chatColor,
      };
      this.broadcast("chat", message);
    });
  }

  async onJoin(
    client: Client,
    options?: { name?: unknown; appearance?: unknown },
    auth?: UserRecord | true,
  ) {
    // The server decides where people appear; the client reads it from its own player
    const spawn = randomSpawn();
    const player = new Player();
    // With sign-in, the name is the one of the profile: the client does not get to choose it
    player.name =
      auth && auth !== true ? auth.name : sanitizeName(options?.name);
    // Only choices from the palettes get through; anything else becomes the default look
    const look = sanitizeAppearance(
      options?.appearance,
      defaultAppearance(player.name),
    );
    Object.assign(player, look);
    if (auth && auth !== true) {
      this.members.set(client.sessionId, auth);
      // The last look they entered with is the one they find next time
      this.saveLook(auth.id, look);
    }
    player.x = spawn.x;
    player.z = spawn.z;
    player.yaw = SPAWN.yaw;
    player.zone = "";
    // The first colour nobody here is using. No await between this and `set`, so
    // two people joining together cannot get the same one.
    player.chatColor = lowestFreeColor(
      [...this.state.players.values()].map((other) => other.chatColor),
    );
    this.state.players.set(client.sessionId, player);
    this.referees.set(
      client.sessionId,
      new MovementValidator(spawn, Date.now(), this.scene.colliders),
    );
    // Before anything that waits, so it is the first thing the player gets
    client.send("layout", {
      version: this.layoutVersion,
      furniture: this.scene.furniture,
      models: this.scene.models,
    } satisfies LayoutMessage);

    this.zones.set(client.sessionId, null);
    const switcher = new ZoneSwitcher(
      (zone) => void this.sendVoice(client, switcher, zone),
      VOICE_SWITCH_GAP_MS,
    );
    this.switchers.set(client.sessionId, switcher);

    await this.sendVoice(client, switcher, null);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.lastChatAt.delete(client.sessionId);
    this.lastLookAt.delete(client.sessionId);
    this.members.delete(client.sessionId);
    this.referees.delete(client.sessionId);
    this.zones.delete(client.sessionId);
    this.boards.forget(client.sessionId);
    this.switchers.get(client.sessionId)?.dispose();
    this.switchers.delete(client.sessionId);
  }

  /** Keeps somebody's look for next time. A failure is only logged: the look still changed in the room. */
  private saveLook(userId: string, look: Appearance) {
    void users.setAppearance(userId, look).catch((error) => {
      console.error("Could not save somebody's look:", error);
    });
  }

  onDispose() {
    this.forgetFloor?.();
  }

  /**
   * Keeps track of which private zone the player is in. They are told right
   * away (for the on-screen badge); their call only moves to the zone's own
   * voice room at a limited pace, because that is what actually keeps the
   * audio private.
   */
  private trackZone(client: Client, x: number, z: number) {
    const previous = this.zones.get(client.sessionId) ?? null;
    const zone = zoneAt(x, z, previous);
    if (zone !== previous) {
      this.zones.set(client.sessionId, zone);
      const player = this.state.players.get(client.sessionId);
      if (player) player.zone = zone ?? "";
      client.send("zone", zone satisfies ZoneMessage);
      // Walking in, they see what is already on the room's boards
      if (zone) this.boards.enteredZone(client.sessionId, zone);
    }
    this.switchers.get(client.sessionId)?.update(zone);
  }

  /** Sends the credentials for the voice room of `zone`, unless the player already left. */
  private async sendVoice(
    client: Client,
    switcher: ZoneSwitcher,
    zone: string | null,
  ) {
    if (!voiceConfig) return;
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const token = await createVoiceToken(
      voiceConfig,
      client.sessionId,
      player.name,
      zone,
    );
    // They may have left, or moved on again, while the token was being signed
    if (this.switchers.get(client.sessionId) !== switcher) return;
    client.send("voice", {
      url: voiceConfig.url,
      token,
      zone,
    } satisfies VoiceCredentials);
  }
}
