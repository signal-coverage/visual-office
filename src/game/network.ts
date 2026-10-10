import { Callbacks, Client, type Room } from "@colyseus/sdk";
import type { ChatMessage } from "../../shared/chat.ts";
import { ROOM_NAME } from "../../shared/constants.ts";
import type { Correction, Move } from "../../shared/movement.ts";
import { OfficeState, type Player } from "../../shared/state.ts";
import type { VoiceCredentials } from "../../shared/voice.ts";
import { resolveServerUrl } from "./serverUrl";

export interface NetworkHandlers {
  /** The server created our own player: this is where it put us. */
  onSelf: (player: Player) => void;
  /** The server rejected a move: we are really here. */
  onCorrect: (correction: Correction) => void;
  onPlayerAdded: (sessionId: string, player: Player) => void;
  onPlayerRemoved: (sessionId: string) => void;
  onChat: (message: ChatMessage) => void;
  onVoice: (credentials: VoiceCredentials) => void;
  /** The connection dropped; the SDK keeps retrying in the background. */
  onDropped: () => void;
  onReconnected: () => void;
  /** Gave up (or was kicked): the room is gone. */
  onDisconnected: () => void;
}

export interface Connection {
  sessionId: string;
  sendMove: (move: Move) => void;
  sendChat: (text: string) => void;
  leave: () => void;
}

export async function connect(
  name: string,
  handlers: NetworkHandlers,
): Promise<Connection> {
  const client = new Client(
    resolveServerUrl({
      configured: import.meta.env.VITE_SERVER_URL,
      dev: import.meta.env.DEV,
      hostname: window.location.hostname,
    }),
  );
  const room: Room<unknown, OfficeState> = await client.joinOrCreate(
    ROOM_NAME,
    { name },
    OfficeState,
  );

  const callbacks = Callbacks.get(room);
  callbacks.onAdd("players", (player, sessionId) => {
    if (sessionId === room.sessionId) handlers.onSelf(player);
    else handlers.onPlayerAdded(sessionId, player);
  });
  room.onMessage("correct", (correction: Correction) =>
    handlers.onCorrect(correction),
  );
  callbacks.onRemove("players", (_player, sessionId) =>
    handlers.onPlayerRemoved(sessionId),
  );
  room.onMessage("chat", (message: ChatMessage) => handlers.onChat(message));
  room.onMessage("voice", (credentials: VoiceCredentials) =>
    handlers.onVoice(credentials),
  );
  room.onDrop(() => handlers.onDropped());
  room.onReconnect(() => handlers.onReconnected());
  room.onLeave(() => handlers.onDisconnected());

  return {
    sessionId: room.sessionId,
    sendMove: (move) => room.send("move", move),
    sendChat: (text) => room.send("chat", { text }),
    leave: () => void room.leave(),
  };
}
