import type { Appearance } from "../../shared/appearance.ts";
import {
  CHAT_REFUSAL_TEXT,
  type ChatMessage,
  type ChatScope,
} from "../../shared/chat.ts";
import { MUTED_NOTICE, UNMUTED_NOTICE } from "../../shared/moderation.ts";
import { isIdle } from "../../shared/presence.ts";
import { shellOrDefault } from "../../shared/defaultShell.ts";
import { buildRoster, type Roster } from "../../shared/roster.ts";
import { ZONES, zonesOf, type Zone } from "../../shared/zones.ts";
import { CallController } from "../game/CallController";
import { COMMON_FLOOR_ID } from "../../shared/floors.ts";
import { connect, type Connection } from "../game/network";
import type { VoiceState } from "../game/VoiceChat";

export interface LiteEvents {
  onChat: (message: ChatMessage, mine: boolean) => void;
  onRoster: (roster: Roster) => void;
  onVoiceState: (state: VoiceState) => void;
  /** How many bars of the microphone meter to light. */
  onMicLevel: (steps: number) => void;
  onNotice: (text: string) => void;
  onReconnecting: (reconnecting: boolean) => void;
  /** The connection is gone for good, on purpose or not. */
  onDisconnected: (code: number) => void;
}

/** How often the call is tuned and its microphone meter read. */
const TICK_MS = 100;
/** How often it is checked whether the person has been away for a while. */
const IDLE_CHECK_MS = 30_000;

/**
 * The office without the 3D scene: the same room, chat and call as the game,
 * for somebody who cannot walk around. It never moves: the person stays where
 * the server put them, and hears everybody in the open office as if standing
 * next to them (there is no distance to tune the volume by).
 */
export class LiteSession {
  private connection: Connection | null = null;
  private disposed = false;
  private events: LiteEvents | null = null;
  private readonly others = new Set<string>();
  /** The private zones of the floor, for the names in the list of people. */
  private zones: readonly Zone[] = ZONES;
  private lastInputAt = performance.now();
  private idle = false;
  private tick: ReturnType<typeof setInterval> | undefined;
  private idleCheck: ReturnType<typeof setInterval> | undefined;
  private readonly call = new CallController(
    {
      onState: (state) => this.events?.onVoiceState(state),
      onMicLevel: (steps) => this.events?.onMicLevel(steps),
      onCamera: () => {},
      onRemoteVideo: () => {},
      onScreen: () => {},
      onNotice: (text) => this.events?.onNotice(text),
    },
    { receiveVideo: false },
  );

  async connect(
    name: string,
    appearance: Appearance,
    events: LiteEvents,
    token: string | null,
    /** The floor to enter: the common one unless told another. */
    floor: string = COMMON_FLOOR_ID,
  ) {
    this.events = events;
    this.call.setMutedByModerator(false);
    const connection = await connect(
      name,
      appearance,
      {
        onSelf: () => {},
        onCorrect: () => {},
        onPlayerAdded: (id) => {
          this.others.add(id);
        },
        onPlayerRemoved: (id) => {
          this.others.delete(id);
        },
        onPlayers: (players, selfId) => {
          if (!this.disposed)
            events.onRoster(buildRoster(players, selfId, this.zones));
        },
        onChat: (message, mine) => {
          if (!this.disposed) events.onChat(message, mine);
        },
        onChatRefused: (reason) => {
          if (!this.disposed) events.onNotice(CHAT_REFUSAL_TEXT[reason]);
        },
        onKnock: () => {},
        onKnocked: () => {},
        onVoice: (credentials) => this.call.setCredentials(credentials),
        onDraw: () => {},
        onClearBoard: () => {},
        onBoard: () => {},
        onZone: () => {},
        onDropped: () => {
          if (!this.disposed) events.onReconnecting(true);
        },
        onReconnected: () => {
          if (!this.disposed) events.onReconnecting(false);
        },
        onLook: () => {},
        onStatus: () => {},
        onEmote: () => {},
        onFloor: () => {},
        onLayout: (layout) => {
          // Only the names of the rooms matter here: the lite screen draws nothing
          this.zones = zonesOf(shellOrDefault(layout.shell));
        },
        onClosing: () => {},
        onReopened: () => {},
        onModerator: () => {},
        onModerated: () => {},
        onSeated: () => {},
        onSeatRefused: () => {},
        onSeat: () => {},
        onVoiceMuted: (muted) => {
          this.call.setMutedByModerator(muted);
          if (!this.disposed)
            events.onNotice(muted ? MUTED_NOTICE : UNMUTED_NOTICE);
        },
        onDisconnected: (code) => {
          this.connection = null;
          this.others.clear();
          this.stopTimers();
          if (this.disposed) return;
          this.call.reset();
          events.onDisconnected(code);
        },
      },
      token,
      floor,
    );
    // dispose() may have run while we were connecting (e.g. React StrictMode)
    if (this.disposed) {
      connection.leave();
      return;
    }
    this.connection = connection;
    this.lastInputAt = performance.now();
    this.idle = false;
    this.tick = setInterval(() => this.tuneCall(), TICK_MS);
    this.idleCheck = setInterval(() => this.checkIdle(), IDLE_CHECK_MS);
  }

  sendChat(text: string, scope: ChatScope, to?: string) {
    this.connection?.sendChat(text, scope, to);
  }

  /** Joins the call (microphone on) the first time, then mutes and unmutes. */
  toggleVoice() {
    this.call.toggleMic();
  }

  /** The person did something: they are not away. */
  touch() {
    this.lastInputAt = performance.now();
  }

  leave() {
    this.connection?.leave();
  }

  dispose() {
    this.disposed = true;
    this.stopTimers();
    this.call.dispose();
    this.connection?.leave();
    this.connection = null;
  }

  /** Everybody is at distance zero: heard at full volume. */
  private tuneCall() {
    this.call.update(TICK_MS / 1000, { x: 0, z: 0 }, (visit) => {
      for (const id of this.others) visit(id, 0, 0);
    });
  }

  private checkIdle() {
    if (!this.connection) return;
    const idle = isIdle(this.lastInputAt, performance.now());
    if (idle === this.idle) return;
    this.idle = idle;
    this.connection.sendIdle(idle);
  }

  private stopTimers() {
    clearInterval(this.tick);
    clearInterval(this.idleCheck);
    this.tick = undefined;
    this.idleCheck = undefined;
  }
}
