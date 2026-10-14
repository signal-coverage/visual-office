import { Room, ServerError, type Client } from "colyseus";
import {
  CHAT_COOLDOWN_MS,
  sanitizeChatRequest,
  type ChatMessage,
} from "../shared/chat.ts";
import {
  defaultAppearance,
  sanitizeAppearance,
  type Appearance,
} from "../shared/appearance.ts";
import { refusalFor } from "../shared/auth.ts";
import {
  sanitizeModerationRequest,
  type ModerationReply,
  type ModeratorMessage,
  type VoiceMutedMessage,
} from "../shared/moderation.ts";
import {
  sanitizeEmote,
  type Emote,
  type EmoteMessage,
} from "../shared/emotes.ts";
import {
  KNOCK_COOLDOWN_MS,
  type KnockAck,
  type KnockMessage,
} from "../shared/knock.ts";
import {
  asStatus,
  DEFAULT_STATUS,
  effectiveStatus,
  sanitizeIdle,
  sanitizeStatus,
  type Status,
} from "../shared/presence.ts";
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
import { randomSpawn } from "../shared/spawn.ts";
import { OfficeState, Player } from "../shared/state.ts";
import { voiceRoomName, type VoiceCredentials } from "../shared/voice.ts";
import { ZONES, zoneAt, type ZoneMessage } from "../shared/zones.ts";
import { routeChat, type ChatPeer } from "./chatRouting.ts";
import { routeKnock, type KnockPeer } from "./knockRouting.ts";
import {
  createVoiceAdmin,
  createVoiceToken,
  voiceConfigFromEnv,
  type VoiceModeration,
} from "./voice.ts";
import { recordAudit } from "./audit.ts";
import { authenticateJoin, users } from "./auth.ts";
import { bans } from "./banStore.ts";
import { BoardService } from "./boardService.ts";
import { companySettings } from "./companySettings.ts";
import {
  floorLocks,
  floorRooms,
  layouts,
  registerModeratedRoom,
  registerRoom,
} from "./floors.ts";
import { mayChangeLook, nextLook, waitedEnough } from "./look.ts";
import { canModerate } from "./moderation.ts";
import { joinBan, moderate } from "./moderationService.ts";
import { nameForPlayer } from "./playerName.ts";
import {
  cooledDown,
  EMOTE_COOLDOWN_MS,
  mayChangeStatus,
  mayEmote,
  STATUS_COOLDOWN_MS,
} from "./presence.ts";
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
/** The least time between two moderation requests of the same person. */
const MODERATION_COOLDOWN_MS = 400;

export class OfficeRoom extends Room<{ state: OfficeState }> {
  maxClients = MAX_PLAYERS_PER_ROOM;
  private readonly lastChatAt = new Map<string, number>();
  private readonly lastLookAt = new Map<string, number>();
  private readonly lastStatusAt = new Map<string, number>();
  private readonly lastEmoteAt = new Map<string, number>();
  private readonly lastKnockAt = new Map<string, number>();
  private readonly lastModerationAt = new Map<string, number>();
  /** Sessions a moderator muted: they get a token without the microphone, and keep it if the call moves. */
  private readonly voiceMuted = new Set<string>();
  private voiceAdmin: VoiceModeration | null = null;
  /** What each player chose, and whether they have gone quiet: the status everybody sees comes from both. */
  private readonly statusInputs = new Map<
    string,
    { manual: Status; idle: boolean }
  >();
  /** Who each signed-in player is, by session: what their look is saved for. */
  private readonly members = new Map<string, UserRecord>();
  private readonly referees = new Map<string, MovementValidator>();
  private readonly zones = new Map<string, string | null>();
  private readonly switchers = new Map<string, ZoneSwitcher>();
  private boards!: BoardService;
  private forgetFloor: (() => void) | null = null;
  private forgetModeration: (() => void) | null = null;
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
    if (who) {
      // A moderator's ban: refused at the door until it ends
      const banned = await joinBan(bans, who.user.id, Date.now());
      if (banned) throw new ServerError(banned.code, banned.message);
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
    this.forgetModeration = registerModeratedRoom(FLOOR_ID, this);

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
      this.voiceAdmin = admin;
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

    // What they are doing: chosen by them, or taken from their quiet and their zone
    this.onMessage("status", (client, payload) => {
      const status = sanitizeStatus(payload);
      const member = this.members.get(client.sessionId) ?? null;
      const inputs = this.statusInputs.get(client.sessionId);
      if (!status || !inputs || !mayChangeStatus(member)) return;
      const now = Date.now();
      if (
        !cooledDown(
          this.lastStatusAt.get(client.sessionId),
          now,
          STATUS_COOLDOWN_MS,
        )
      )
        return;
      this.lastStatusAt.set(client.sessionId, now);
      inputs.manual = status;
      this.refreshStatus(client.sessionId);
    });
    // The game says when its player stops touching anything, and when they come back
    this.onMessage("idle", (client, payload) => {
      const idle = sanitizeIdle(payload);
      const inputs = this.statusInputs.get(client.sessionId);
      if (idle === null || !inputs) return;
      inputs.idle = idle;
      this.refreshStatus(client.sessionId);
    });

    this.onMessage("emote", (client, payload) => {
      const emote: Emote | null = sanitizeEmote(payload);
      const member = this.members.get(client.sessionId) ?? null;
      if (!emote || !this.state.players.has(client.sessionId)) return;
      if (!mayEmote(member)) return;
      const now = Date.now();
      if (
        !cooledDown(
          this.lastEmoteAt.get(client.sessionId),
          now,
          EMOTE_COOLDOWN_MS,
        )
      )
        return;
      this.lastEmoteAt.set(client.sessionId, now);
      this.broadcast("emote", {
        id: client.sessionId,
        emote,
      } satisfies EmoteMessage);
    });

    this.onMessage("chat", (client, payload) => {
      const request = sanitizeChatRequest(payload);
      const player = this.state.players.get(client.sessionId);
      if (!request || !player) return;

      const now = Date.now();
      if (now - (this.lastChatAt.get(client.sessionId) ?? 0) < CHAT_COOLDOWN_MS)
        return;
      this.lastChatAt.set(client.sessionId, now);

      // Who receives it is the server's call, from where everybody really is
      const route = routeChat(
        client.sessionId,
        this.peers(),
        request.scope === "dm"
          ? { scope: "dm", to: request.to ?? "" }
          : { scope: request.scope },
      );
      if (!route.ok) {
        client.send("chatRefused", { reason: route.reason });
        return;
      }
      const receiver =
        request.scope === "dm" && request.to
          ? this.state.players.get(request.to)
          : undefined;
      const message: ChatMessage = {
        id: client.sessionId,
        name: player.name,
        text: request.text,
        at: now,
        color: player.chatColor,
        scope: request.scope,
        ...(receiver && request.to
          ? { to: request.to, toName: receiver.name }
          : {}),
      };
      for (const { id, quiet } of route.deliveries)
        this.clients
          .find((c) => c.sessionId === id)
          ?.send("chat", { ...message, quiet } satisfies ChatMessage);
    });

    // A moderator's request: the server decides from who they really are, never from the message
    this.onMessage("moderate", (client, payload) => {
      void this.moderateFrom(client, payload);
    });

    // Knocking only tells people: it changes nothing about any door
    this.onMessage("knock", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const route = routeKnock(client.sessionId, this.peers());
      if (!route) {
        client.send("knocked", { knocked: false } satisfies KnockAck);
        return;
      }
      const now = Date.now();
      if (
        !cooledDown(
          this.lastKnockAt.get(client.sessionId),
          now,
          KNOCK_COOLDOWN_MS,
        )
      ) {
        client.send("knocked", {
          knocked: false,
          reason: "cooldown",
        } satisfies KnockAck);
        return;
      }
      this.lastKnockAt.set(client.sessionId, now);
      const message: KnockMessage = {
        id: client.sessionId,
        name: player.name,
        place: route.zone,
      };
      for (const id of route.notify)
        this.clients.find((c) => c.sessionId === id)?.send("knock", message);
      client.send("knocked", { knocked: true } satisfies KnockAck);
    });
  }

  /** Whether the company lets people choose their name. Off when it cannot be found out. */
  private async mayChooseName(): Promise<boolean> {
    try {
      return await companySettings.allowNameEdit();
    } catch (error) {
      console.error(
        "Could not read whether people may choose their name",
        error,
      );
      return false;
    }
  }

  async onJoin(
    client: Client,
    options?: { name?: unknown; appearance?: unknown },
    auth?: UserRecord | true,
  ) {
    // The server decides where people appear; the client reads it from its own player
    const spawn = randomSpawn();
    const player = new Player();
    // With sign-in, the name is the one of the profile, unless the company lets people choose
    player.name = nameForPlayer({
      profileName: auth && auth !== true ? auth.name : null,
      allowEdit: auth && auth !== true ? await this.mayChooseName() : false,
      requested: options?.name,
    });
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
    player.status = DEFAULT_STATUS;
    this.statusInputs.set(client.sessionId, {
      manual: DEFAULT_STATUS,
      idle: false,
    });
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

    if (auth && auth !== true)
      client.send("moderator", {
        can: await this.mayModerateHere(auth),
      } satisfies ModeratorMessage);

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
    this.lastStatusAt.delete(client.sessionId);
    this.lastEmoteAt.delete(client.sessionId);
    this.lastKnockAt.delete(client.sessionId);
    this.lastModerationAt.delete(client.sessionId);
    this.voiceMuted.delete(client.sessionId);
    this.statusInputs.delete(client.sessionId);
    this.members.delete(client.sessionId);
    this.referees.delete(client.sessionId);
    this.zones.delete(client.sessionId);
    this.boards.forget(client.sessionId);
    this.switchers.get(client.sessionId)?.dispose();
    this.switchers.delete(client.sessionId);
  }

  /** Everybody in the room, as chat and knocks need to know them: where they are and what they show as doing. */
  private peers(): (ChatPeer & KnockPeer)[] {
    const peers: (ChatPeer & KnockPeer)[] = [];
    this.state.players.forEach((player, id) =>
      peers.push({
        id,
        x: player.x,
        z: player.z,
        yaw: player.yaw,
        zone: player.zone || null,
        status: asStatus(player.status),
      }),
    );
    return peers;
  }

  /** Works out what everybody should see somebody as doing, and says it only when it changed. */
  private refreshStatus(sessionId: string) {
    const player = this.state.players.get(sessionId);
    const inputs = this.statusInputs.get(sessionId);
    if (!player || !inputs) return;
    const status = effectiveStatus({
      ...inputs,
      inZone: this.zones.get(sessionId) != null,
    });
    if (player.status !== status) player.status = status;
  }

  /** Keeps somebody's look for next time. A failure is only logged: the look still changed in the room. */
  private saveLook(userId: string, look: Appearance) {
    void users.setAppearance(userId, look).catch((error) => {
      console.error("Could not save somebody's look:", error);
    });
  }

  onDispose() {
    this.forgetFloor?.();
    this.forgetModeration?.();
  }

  /** Whether the person may moderate this floor, by the roles they have now. False when that cannot be found out. */
  private async mayModerateHere(user: UserRecord): Promise<boolean> {
    try {
      return canModerate(await users.rolesOf(user.id), FLOOR_ID);
    } catch (error) {
      console.error("Could not look up who may moderate:", error);
      return false;
    }
  }

  /** A moderator's action. Who asks and who it is for come from this room's own record of its sessions, never from the message. */
  private async moderateFrom(client: Client, payload: unknown) {
    const request = sanitizeModerationRequest(payload);
    if (!request) return;
    client.send("moderated", await this.moderationReply(client, request));
  }

  private async moderationReply(
    client: Client,
    request: NonNullable<ReturnType<typeof sanitizeModerationRequest>>,
  ): Promise<ModerationReply> {
    const actor = this.members.get(client.sessionId);
    if (!actor) return { ok: false, reason: "not_allowed" };
    const now = Date.now();
    if (
      !cooledDown(
        this.lastModerationAt.get(client.sessionId),
        now,
        MODERATION_COOLDOWN_MS,
      )
    )
      return { ok: false, reason: "unavailable" };
    this.lastModerationAt.set(client.sessionId, now);
    const target = this.members.get(request.target);
    if (!target) return { ok: false, reason: "gone" };
    try {
      return await moderate(
        {
          id: actor.id,
          name: actor.name,
          roles: await users.rolesOf(actor.id),
        },
        {
          action: request.action,
          targetUserId: target.id,
          minutes: request.minutes,
        },
        FLOOR_ID,
        { users, bans, rooms: floorRooms, audit: recordAudit, now: Date.now },
      );
    } catch (error) {
      console.error("Could not moderate:", error);
      return { ok: false, reason: "unavailable" };
    }
  }

  /** Disconnects every session of this person in the room. Returns how many there were. */
  removeUser(userId: string, code: number, message: string): number {
    let removed = 0;
    for (const client of [...this.clients]) {
      if (this.members.get(client.sessionId)?.id !== userId) continue;
      client.leave(code, message);
      removed++;
    }
    return removed;
  }

  /**
   * Takes this person's microphone away, or gives it back: the token the server
   * issues them says what they may publish, and in the call they are in now it
   * changes at once. Returns how many sessions of theirs there were.
   */
  async setVoiceMuted(userId: string, muted: boolean): Promise<number> {
    const sessions = this.clients.filter(
      (client) => this.members.get(client.sessionId)?.id === userId,
    );
    for (const client of sessions) {
      if (muted) this.voiceMuted.add(client.sessionId);
      else this.voiceMuted.delete(client.sessionId);
      client.send("voiceMuted", { muted } satisfies VoiceMutedMessage);
    }
    if (voiceConfig && this.voiceAdmin)
      for (const client of sessions) {
        const zone = this.switchers.get(client.sessionId)?.issuedZone ?? null;
        await this.voiceAdmin.setCanSpeak(
          voiceRoomName(zone, voiceConfig.roomPrefix),
          client.sessionId,
          zone,
          !muted,
        );
      }
    return sessions.length;
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
      this.refreshStatus(client.sessionId);
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
      !this.voiceMuted.has(client.sessionId),
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
