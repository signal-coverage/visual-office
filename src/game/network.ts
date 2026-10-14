import { Callbacks, Client, type Room } from "@colyseus/sdk";
import type { Appearance } from "../../shared/appearance.ts";
import type { Emote, EmoteMessage } from "../../shared/emotes.ts";
import { asStatus, type Status } from "../../shared/presence.ts";
import type { ChatMessage, ChatRefusal, ChatScope } from "../../shared/chat.ts";
import type { KnockAck, KnockMessage } from "../../shared/knock.ts";
import type {
  ModerationAction,
  ModerationReply,
  ModeratorMessage,
  VoiceMutedMessage,
} from "../../shared/moderation.ts";
import type { ClosingMessage, LayoutMessage } from "../../shared/floors.ts";
import { ROOM_NAME } from "../../shared/constants.ts";
import type { Point, Stroke, StrokeMessage } from "../../shared/drawing.ts";
import type { Correction, Move } from "../../shared/movement.ts";
import type { RosterEntry } from "../../shared/roster.ts";
import { OfficeState, type Player } from "../../shared/state.ts";
import type { VoiceCredentials } from "../../shared/voice.ts";
import type { ZoneMessage } from "../../shared/zones.ts";
import { currentServerUrl } from "./serverAddress";

/** The parts of a player's look, as they are in the room's state. */
const LOOK_FIELDS = [
  "skin",
  "hairColor",
  "hairStyle",
  "shirt",
  "pants",
] as const;

export interface NetworkHandlers {
  /** The server created our own player: this is where it put us. */
  onSelf: (player: Player) => void;
  /** The server rejected a move: we are really here. */
  onCorrect: (correction: Correction) => void;
  onPlayerAdded: (sessionId: string, player: Player) => void;
  onPlayerRemoved: (sessionId: string) => void;
  /** Somebody joined, left or changed zone: everybody who is in the session now. */
  onPlayers: (players: RosterEntry[], selfId: string) => void;
  /** A chat message for us, and whether we sent it (it comes back to us too). */
  onChat: (message: ChatMessage, mine: boolean) => void;
  /** The server did not deliver what we sent. */
  onChatRefused: (reason: ChatRefusal) => void;
  /** Somebody is knocking on us, or on the private room we are in. */
  onKnock: (message: KnockMessage) => void;
  /** What came of our own knock. */
  onKnocked: (ack: KnockAck) => void;
  onVoice: (credentials: VoiceCredentials) => void;
  /** Somebody in our zone drew a piece of a stroke on a board. */
  onDraw: (stroke: {
    board: string;
    id: string;
    ink: number;
    points: Point[];
  }) => void;
  onClearBoard: (board: string) => void;
  /** What a board holds, sent when we walk into its zone. */
  onBoard: (board: string, strokes: Stroke[]) => void;
  /** We walked into a private zone (its id) or back out into the open office (null). */
  onZone: (zone: ZoneMessage) => void;
  /** The connection dropped; the SDK keeps retrying in the background. */
  onDropped: () => void;
  onReconnected: () => void;
  /** Gave up (or was kicked): the room is gone. */
  onDisconnected: (code: number) => void;
  /** Somebody else changed how they look. */
  onLook: (sessionId: string, player: Player) => void;
  /** Somebody else (not us) is doing something else now. */
  onStatus: (sessionId: string, status: Status) => void;
  /** Somebody made a gesture. */
  onEmote: (message: EmoteMessage) => void;
  /** What stands in the floor, sent as soon as we join. */
  onLayout: (layout: LayoutMessage) => void;
  /** The floor is about to close for editing: this many seconds left. */
  onClosing: (seconds: number) => void;
  /** The editor finished before the time was up: the floor stays open. */
  onReopened: () => void;
  /** Whether we may moderate this floor, as the server says when we join. */
  onModerator: (can: boolean) => void;
  /** What came of something we asked as a moderator. */
  onModerated: (reply: ModerationReply) => void;
  /** A moderator muted our voice, or let us speak again. */
  onVoiceMuted: (muted: boolean) => void;
}

export interface Connection {
  sessionId: string;
  sendMove: (move: Move) => void;
  /** Sends a message; for a direct one, `to` is the session of the person. The server decides who gets it. */
  sendChat: (text: string, scope: ChatScope, to?: string) => void;
  /** Knocks: on the private room we stand at, or on the person we face. */
  sendKnock: () => void;
  /** Tells the room how we look now. The server checks it and everybody sees it. */
  sendAppearance: (look: Appearance) => void;
  /** Tells the room what we choose to show as doing. The server checks it and everybody sees it. */
  sendStatus: (status: Status) => void;
  /** Tells the room that we stopped touching anything (true) or are back (false). */
  sendIdle: (idle: boolean) => void;
  sendEmote: (emote: Emote) => void;
  sendDraw: (stroke: StrokeMessage) => void;
  sendClearBoard: (board: string) => void;
  /** Asks the server, as a moderator, to do something to somebody in the room (a session id). It checks who we are. */
  sendModerate: (
    action: ModerationAction,
    target: string,
    minutes?: number,
  ) => void;
  leave: () => void;
}

export async function connect(
  name: string,
  appearance: Appearance,
  handlers: NetworkHandlers,
  /** Proof of who is entering, when the server asks for sign-in. */
  token: string | null = null,
): Promise<Connection> {
  const client = new Client(currentServerUrl());
  const room: Room<unknown, OfficeState> = await client.joinOrCreate(
    ROOM_NAME,
    { name, appearance, ...(token ? { token } : {}) },
    OfficeState,
  );

  const publishPlayers = () => {
    const players: RosterEntry[] = [];
    room.state.players.forEach((player, id) =>
      players.push({
        id,
        name: player.name,
        zone: player.zone || null,
        color: player.chatColor,
        status: asStatus(player.status),
      }),
    );
    handlers.onPlayers(players, room.sessionId);
  };

  const callbacks = Callbacks.get(room);
  callbacks.onAdd("players", (player, sessionId) => {
    if (sessionId === room.sessionId) handlers.onSelf(player);
    else handlers.onPlayerAdded(sessionId, player);
    callbacks.listen(player, "zone", publishPlayers);
    callbacks.listen(player, "status", () => {
      if (sessionId !== room.sessionId)
        handlers.onStatus(sessionId, asStatus(player.status));
      publishPlayers();
    });
    // Their look is drawn again when it changes (not our own: we do not see ourselves)
    if (sessionId !== room.sessionId)
      for (const field of LOOK_FIELDS)
        callbacks.listen(player, field, () =>
          handlers.onLook(sessionId, player),
        );
    publishPlayers();
  });
  room.onMessage("correct", (correction: Correction) =>
    handlers.onCorrect(correction),
  );
  callbacks.onRemove("players", (_player, sessionId) => {
    handlers.onPlayerRemoved(sessionId);
    publishPlayers();
  });
  room.onMessage("emote", (message: EmoteMessage) => handlers.onEmote(message));
  room.onMessage("chat", (message: ChatMessage) =>
    handlers.onChat(message, message.id === room.sessionId),
  );
  room.onMessage("chatRefused", ({ reason }: { reason: ChatRefusal }) =>
    handlers.onChatRefused(reason),
  );
  room.onMessage("knock", (message: KnockMessage) => handlers.onKnock(message));
  room.onMessage("knocked", (ack: KnockAck) => handlers.onKnocked(ack));
  room.onMessage("voice", (credentials: VoiceCredentials) =>
    handlers.onVoice(credentials),
  );
  room.onMessage("zone", (zone: ZoneMessage) => handlers.onZone(zone));
  room.onMessage("draw", (stroke) => handlers.onDraw(stroke));
  room.onMessage("clearBoard", ({ board }: { board: string }) =>
    handlers.onClearBoard(board),
  );
  room.onMessage(
    "board",
    ({ board, strokes }: { board: string; strokes: Stroke[] }) =>
      handlers.onBoard(board, strokes),
  );
  room.onDrop(() => handlers.onDropped());
  room.onReconnect(() => handlers.onReconnected());
  room.onMessage("closing", ({ seconds }: ClosingMessage) =>
    handlers.onClosing(seconds),
  );
  room.onMessage("reopened", () => handlers.onReopened());
  room.onMessage("moderator", ({ can }: ModeratorMessage) =>
    handlers.onModerator(can === true),
  );
  room.onMessage("moderated", (reply: ModerationReply) =>
    handlers.onModerated(reply),
  );
  room.onMessage("voiceMuted", ({ muted }: VoiceMutedMessage) =>
    handlers.onVoiceMuted(muted === true),
  );
  room.onMessage("layout", (layout: LayoutMessage) =>
    handlers.onLayout(layout),
  );
  room.onLeave((code) => handlers.onDisconnected(code));

  return {
    sessionId: room.sessionId,
    sendMove: (move) => room.send("move", move),
    sendChat: (text, scope, to) =>
      room.send("chat", { text, scope, ...(to ? { to } : {}) }),
    sendKnock: () => room.send("knock", {}),
    sendAppearance: (look) => room.send("appearance", look),
    sendStatus: (status) => room.send("status", { status }),
    sendIdle: (idle) => room.send("idle", { idle }),
    sendEmote: (emote) => room.send("emote", { emote }),
    sendDraw: (stroke) => room.send("draw", stroke),
    sendClearBoard: (board) => room.send("clearBoard", { board }),
    sendModerate: (action, target, minutes) =>
      room.send("moderate", {
        action,
        target,
        ...(minutes === undefined ? {} : { minutes }),
      }),
    leave: () => void room.leave(),
  };
}
