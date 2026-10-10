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
import { createVoiceToken, voiceConfigFromEnv } from "./voice.ts";

const voiceConfig = voiceConfigFromEnv(process.env);

export class OfficeRoom extends Room<{ state: OfficeState }> {
  maxClients = MAX_PLAYERS_PER_ROOM;
  private readonly lastChatAt = new Map<string, number>();
  private readonly referees = new Map<string, MovementValidator>();

  onCreate() {
    this.state = new OfficeState();

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

    if (voiceConfig) {
      const token = await createVoiceToken(
        voiceConfig,
        client.sessionId,
        player.name,
      );
      client.send("voice", {
        url: voiceConfig.url,
        token,
      } satisfies VoiceCredentials);
    }
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.lastChatAt.delete(client.sessionId);
    this.referees.delete(client.sessionId);
  }
}
