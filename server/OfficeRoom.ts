import { Room, type Client } from "colyseus";
import {
  CHAT_COOLDOWN_MS,
  sanitizeChat,
  type ChatMessage,
} from "../shared/chat.ts";
import { MAX_PLAYERS_PER_ROOM, SPAWN } from "../shared/constants.ts";
import { OFFICE_COLLIDERS } from "../shared/layout.ts";
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
import { enforceZones } from "./zoneEnforcer.ts";
import { ZoneSwitcher } from "./zoneSwitcher.ts";

const voiceConfig = voiceConfigFromEnv(process.env);

/** Minimum time between two moves of somebody's call from one voice room to another. */
const VOICE_SWITCH_GAP_MS = 1000;
/** How often to remove from a voice room whoever the server did not send there. */
const ENFORCE_INTERVAL_MS = 5000;

export class OfficeRoom extends Room<{ state: OfficeState }> {
  maxClients = MAX_PLAYERS_PER_ROOM;
  private readonly lastChatAt = new Map<string, number>();
  private readonly referees = new Map<string, MovementValidator>();
  private readonly zones = new Map<string, string | null>();
  private readonly switchers = new Map<string, ZoneSwitcher>();

  onCreate() {
    this.state = new OfficeState();

    if (voiceConfig) {
      const admin = createVoiceAdmin(voiceConfig);
      const rooms = [null, ...ZONES.map((zone) => zone.id)];
      this.clock.setInterval(() => {
        void enforceZones(
          admin,
          rooms,
          (id) => this.switchers.get(id)?.issuedZone,
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
      };
      this.broadcast("chat", message);
    });
  }

  async onJoin(client: Client, options?: { name?: unknown }) {
    // The server decides where people appear; the client reads it from its own player
    const spawn = randomSpawn();
    const player = new Player();
    player.name = sanitizeName(options?.name);
    player.x = spawn.x;
    player.z = spawn.z;
    player.yaw = SPAWN.yaw;
    this.state.players.set(client.sessionId, player);
    this.referees.set(
      client.sessionId,
      new MovementValidator(spawn, Date.now(), OFFICE_COLLIDERS),
    );

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
    this.referees.delete(client.sessionId);
    this.zones.delete(client.sessionId);
    this.switchers.get(client.sessionId)?.dispose();
    this.switchers.delete(client.sessionId);
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
      client.send("zone", zone satisfies ZoneMessage);
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
