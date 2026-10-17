import * as THREE from "three";
import { MAP_KEY } from "../floors/consts";
import type { Appearance } from "../../shared/appearance.ts";
import {
  CHAT_REFUSAL_TEXT,
  type ChatMessage,
  type ChatScope,
} from "../../shared/chat.ts";
import { knockAckText, knockText } from "../../shared/knock.ts";
import {
  moderationReplyText,
  MUTED_NOTICE,
  UNMUTED_NOTICE,
  type ModerationAction,
} from "../../shared/moderation.ts";
import {
  EMOTE_ICONS,
  EMOTE_LABELS,
  emoteByKey,
  type Emote,
} from "../../shared/emotes.ts";
import {
  DEFAULT_STATUS,
  isIdle,
  nextStatus,
  STATUS_LABELS,
  type Status,
} from "../../shared/presence.ts";
import { moveWithCollisions } from "../../shared/collision.ts";
import {
  actionFor,
  aimedInteractable,
  hintFor,
  panelFor,
  panelUsesMouse,
  type Interactable,
  type InteractionKind,
  type PanelContent,
} from "../../shared/interactions.ts";
import { SEAT_REFUSAL_TEXT } from "../../shared/seats.ts";
import {
  MOVE_SEND_RATE,
  PLAYER_RADIUS,
  SPAWN,
} from "../../shared/constants.ts";
import type { FloorMessage, LayoutMessage } from "../../shared/floors.ts";
import {
  OFFICE_COLLIDERS,
  OFFICE_INTERACTABLES,
  sceneFor,
  type FloorScene,
} from "../../shared/layout.ts";
import { OFFICE_FURNITURE } from "../../shared/officeData.ts";
import { buildRoster, type Roster } from "../../shared/roster.ts";
import { randomSpawn } from "../../shared/spawn.ts";
import { ZONES, zoneLabel, type Zone } from "../../shared/zones.ts";
import { AREAS, areaAt, type Area } from "../../shared/areas.ts";
import { CallController, type ScreenView } from "./CallController";
import { FpsMeter } from "./FpsMeter";
import { isSoftwareRenderer, readGpuName } from "./gpu";
import { shouldDropKeys } from "./lockKeys";
import { connect, type Connection } from "./network";
import type { DetailLevel } from "./furnitureLook";
import { buildOffice, disposeOffice } from "./office";
import { loadProps } from "./props";
import {
  describeQuality,
  pixelRatioFor,
  QUALITY_PROFILES,
  resolveLevel,
  startAutoQuality,
  stepAutoQuality,
  type AutoQualityState,
  type QualityChoice,
  type QualityLevel,
} from "./quality";
import { MOUSE_SENSITIVITY, TOUCH_LOOK_GAIN, turnView } from "./look";
import { lerp } from "./math";
import { keyIntent, moveStep } from "./moveIntent";
import { RemotePlayers } from "./RemotePlayers";
import { SEATED_EYE_HEIGHT, STANDING_EYE_HEIGHT } from "./seatedPose";
import type { TouchSource } from "../touch/touchInput";
import { ScreenDisplay } from "./ScreenDisplay";
import { Whiteboards, type BoardAim } from "./Whiteboards";
import type { VoiceState } from "./VoiceChat";

export interface GameEvents {
  /** A chat message for us (and our own, which come back), and whether we sent it. */
  onChat: (message: ChatMessage, mine: boolean) => void;
  /** Somebody is knocking on us or on our room: what to say about it. */
  onKnock: (text: string) => void;
  onVoiceState: (state: VoiceState) => void;
  /** How many bars of the microphone meter to light (0 when we are not transmitting). */
  onMicLevel: (steps: number) => void;
  /** Who is around, as the list should show it: changes when people come, go or change zone. */
  onRoster: (roster: Roster) => void;
  /** The name of the private zone we walked into, or null when we are back in the open office. */
  onZone: (label: string | null) => void;
  /** The part of the office we are in (the kitchen, the lounge...), only to say where we are: it changes nothing about who we talk to. */
  onArea: (label: string) => void;
  /** A board is within reach and we are looking at it (with the pen we hold), or no longer. */
  onBoardAim: (aim: BoardAim | null) => void;
  /** Who is sharing a screen in our call, for the on-screen note. */
  onScreenShare: (info: ScreenShareInfo) => void;
  /** Something to tell the player, e.g. why sharing is not possible here. */
  onNotice: (text: string) => void;
  /** Our camera turned on (with a preview to show) or off (null). */
  onCamera: (on: boolean, selfView: HTMLVideoElement | null) => void;
  /** Connection lost but still retrying (true), or recovered (false). */
  onReconnecting: (reconnecting: boolean) => void;
  /**
   * The server connection is gone for good (not called for a deliberate dispose).
   * `code` says why, e.g. FLOOR_CLOSED_CODE when the floor closed for editing.
   */
  onDisconnected: (code: number) => void;
  /** Which floor we are on, as the server says when we join. */
  onFloor: (floor: FloorMessage) => void;
  /** The floor will close for editing in this many seconds, or (null) it will not after all. */
  onFloorClosing: (seconds: number | null) => void;
  /** What we chose to show as doing changed (with the key, or the menu): the part of the status that is ours to set. */
  onStatusChosen: (status: Status) => void;
  /** The key of the map of rooms was pressed. */
  onMapKey: () => void;
  /** The emote key is held (true) or let go (false): the list of emotes is shown meanwhile. */
  onEmoteKey: (held: boolean) => void;
  /** Whether the server lets us moderate this floor: it decides, and checks again on every action. */
  onModerator: (can: boolean) => void;
  /** What using where we look would do (or how to get up while sitting), or null when there is nothing to use. With touch controls it is the action alone ("Sit down"), for a button. */
  onInteractHint: (hint: string | null) => void;
  /** We sat down or got up: a screen with no keys offers a button to stand. */
  onSeatedChange: (seated: boolean) => void;
  /** What we used (a computer, a shelf, a plant) is to be shown, or null when it is closed. */
  onInteractPanel: (panel: PanelContent | null) => void;
}

/** Whether a screen is being shared in our call, and by whom. */
export type ScreenShareInfo =
  { kind: "none" } | { kind: "local" } | { kind: "remote"; name: string };

/** What is needed to tell, from the player's side, why the game might feel slow. */
export interface Diagnostics {
  fps: number;
  /** The longest single frame of the last half second (ms): stutter hides in averages. */
  worstFrameMs: number;
  gpu: string;
  softwareRendering: boolean;
  pixelRatio: number;
  width: number;
  height: number;
  drawCalls: number;
  triangles: number;
  /** Times the server moved us back because it disagreed with our position. */
  corrections: number;
  /** The quality in use, and whether the game chose it (auto). */
  quality: string;
}

/** What the game needs to know about the computer before it draws: the antialias cannot change later. */
export interface GameOptions {
  quality: QualityChoice;
  softwareRendering: boolean;
  /** The office is walked with fingers: no mouse is captured, and the game reads a touch source instead. */
  touch?: boolean;
}

const DEFAULT_OPTIONS: GameOptions = {
  quality: "auto",
  softwareRendering: false,
};

const NO_EVENTS: GameEvents = {
  onChat: () => {},
  onKnock: () => {},
  onVoiceState: () => {},
  onMicLevel: () => {},
  onRoster: () => {},
  onZone: () => {},
  onArea: () => {},
  onBoardAim: () => {},
  onScreenShare: () => {},
  onNotice: () => {},
  onCamera: () => {},
  onReconnecting: () => {},
  onDisconnected: () => {},
  onFloor: () => {},
  onFloorClosing: () => {},
  onStatusChosen: () => {},
  onMapKey: () => {},
  onEmoteKey: () => {},
  onModerator: () => {},
  onInteractHint: () => {},
  onSeatedChange: () => {},
  onInteractPanel: () => {},
};

const SEND_INTERVAL = 1 / MOVE_SEND_RATE;
const VOICE_KEY = "KeyM";
const CAMERA_KEY = "KeyC";
/** Shares your screen on the wall screen of the room you are in. */
const SCREEN_KEY = "KeyP";
/** Goes round the statuses: available, in a meeting, do not disturb, away. */
const STATUS_KEY = "KeyZ";
/** Knocks on the private room you stand at, or on the person you face. */
const KNOCK_KEY = "KeyK";
/** Held, the number keys make a gesture instead of choosing a pen. */
const EMOTE_KEY = "KeyE";

/** The least time between two status changes we send: a little more than the server's own wait. */
const STATUS_SEND_GAP_MS = 500;
/** Wipes the board you are pointing at. */
const CLEAR_BOARD_KEY = "Backspace";
/** Uses what we look at, or gets up when we sit. */
const INTERACT_KEY = "KeyF";
const STAND_KEY = "Space";
/** Pressing one of these gets us up from a seat and closes what we are reading. */
const MOVE_KEYS: ReadonlySet<string> = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
]);
const STAND_HINT = "F or Space · Stand up";
const STAND_ACTION = "Stand up";
/** A little more than the server's own wait between sitting and getting up. */
const STAND_RETRY_MS = 350;
/** How quickly the eyes go down to the seat and up again. */
const EYE_EASING = 10;

/** For each seat of a layout, whether it faces a desk. */
function seatsOf(interactables: Interactable[]): Map<string, boolean> {
  return new Map(
    interactables.flatMap((entry) =>
      entry.seat ? [[entry.id, entry.seat.atDesk] as const] : [],
    ),
  );
}

/** What a floor is drawn from until the server says what it is made of: the main office, without its own models. */
const DEFAULT_SCENE = sceneFor({ furniture: OFFICE_FURNITURE, models: [] });

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private lastFrameTime = performance.now();
  private readonly keys = new Set<string>();
  // What stands in the floor: the default every build carries until the server says otherwise
  private office: THREE.Group;
  /** What the office was last built from, and with how much detail. */
  private officeScene: Parameters<typeof buildOffice>[0];
  private officeDetail: DetailLevel;
  private props = loadProps();
  private colliders = OFFICE_COLLIDERS;
  private interactables = OFFICE_INTERACTABLES;
  /** The private zones and the named areas of the floor: the main office's until the server says what the floor is. */
  private zones: readonly Zone[] = ZONES;
  private areas: readonly Area[] = AREAS;
  /** The private zone we are in (its id), or null in the open floor. */
  private zone: string | null = null;
  /** The seat we sit in, as the server put us there; null while standing. */
  private seat: { id: string; yaw: number } | null = null;
  /** What we look at and could use, and the hint we told the screen about it. */
  private interactAim: Interactable | null = null;
  private shownHint: string | null = null;
  private panelOpen = false;
  /** What the open panel is about: a computer or a shelf has the mouse free. */
  private panelKind: InteractionKind | null = null;
  private eyeHeight = STANDING_EYE_HEIGHT;
  /** The stored layout version drawn now, or null for the default. */
  /** Which layout is drawn: "default" for the one every build carries (the same on every floor), else the floor and its version. */
  private layoutKey = "default";
  /** The floor we are on, so a published version of one floor is not taken for the same version of another. */
  private floorId = "";
  private position: { x: number; z: number };
  private yaw = 0;
  private pitch = 0;
  private frameId = 0;

  private readonly canvas: HTMLCanvasElement;
  private readonly remotePlayers: RemotePlayers;
  private connection: Connection | null = null;
  private disposed = false;
  private sinceLastSend = 0;
  private lastSent = { x: NaN, z: NaN, yaw: NaN };
  /** True until the server tells us where it put us: nothing is reported before that. */
  private awaitingSpawn = false;
  private reconnecting = false;
  private events = NO_EVENTS;
  private readonly call: CallController;
  private readonly whiteboards: Whiteboards;
  /** The screens on the walls of the floor, each for the zone it belongs to. */
  private screens: Array<{ zone: string; display: ScreenDisplay }> = [];
  /** What the screens show, when it is the screen of the zone we are in. */
  private screenView: ScreenView = { kind: "none" };
  /** The left mouse button is down while the mouse is captured. */
  private drawing = false;
  /** Whether the mouse was captured the last time the browser announced a change. */
  private wasLocked = false;
  private boardAim: BoardAim | null = null;
  private area: string | null = null;
  private readonly lookDirection = new THREE.Vector3();
  private readonly fpsMeter = new FpsMeter();
  private readonly gpu: string;
  private corrections = 0;
  private mouseSensitivity = MOUSE_SENSITIVITY;
  /** The office is walked with fingers: nothing captures the mouse. */
  private readonly touchMode: boolean;
  /** What fingers on the screen ask for, once the touch controls are up. */
  private touchSource: TouchSource | null = null;
  /** Whether the joystick was pushed on the last frame: a push that starts gets us up from a seat. */
  private touchPushing = false;
  private readonly tapRay = new THREE.Vector3();
  private standRetry: ReturnType<typeof setTimeout> | undefined;
  /** What we chose to show as doing: the server adds away and busy when they apply. */
  private chosenStatus: Status = DEFAULT_STATUS;
  private lastStatusSentAt = -Infinity;
  private lastInputAt = performance.now();
  /** Whether the server was told we stopped touching anything. */
  private idle = false;
  private emoteKeyHeld = false;
  private qualityChoice: QualityChoice;
  private readonly softwareRendering: boolean;
  private auto: AutoQualityState;
  private level: QualityLevel;
  private frame = 0;
  private sun: THREE.DirectionalLight | null = null;
  private removeE2eHook: (() => void) | null = null;
  private canvasObserver: ResizeObserver | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    options: GameOptions = DEFAULT_OPTIONS,
  ) {
    this.canvas = canvas;
    this.qualityChoice = options.quality;
    this.softwareRendering = options.softwareRendering;
    this.touchMode = options.touch ?? false;
    this.auto = startAutoQuality(options.softwareRendering, this.touchMode);
    this.level = resolveLevel(options.quality, {
      softwareRendering: options.softwareRendering,
      autoLevel: this.auto.level,
    });
    this.officeDetail = QUALITY_PROFILES[this.level].furnitureDetail;
    this.office = buildOffice(this.officeScene, this.officeDetail);
    // On machines with two graphics cards the browser picks the weak one by default
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: QUALITY_PROFILES[this.level].antialias,
      powerPreference: "high-performance",
    });
    this.gpu = readGpuName(this.renderer.getContext());
    this.renderer.shadowMap.enabled = true;
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    this.position = randomSpawn();
    this.yaw = SPAWN.yaw;
    this.remotePlayers = new RemotePlayers(
      this.scene,
      QUALITY_PROFILES[this.level].avatarDetail,
    );
    this.remotePlayers.setSeats(seatsOf(this.interactables));
    this.call = new CallController({
      onState: (state) => this.events.onVoiceState(state),
      onMicLevel: (steps) => this.events.onMicLevel(steps),
      onCamera: (on, selfView) => this.events.onCamera(on, selfView),
      onRemoteVideo: (id, element) => this.remotePlayers.setVideo(id, element),
      onScreen: (view) => {
        this.screenView = view;
        this.showScreenView();
        this.events.onScreenShare(
          view.kind === "remote"
            ? { kind: "remote", name: view.name }
            : view.kind === "local"
              ? view
              : { kind: "none" },
        );
      },
      onNotice: (text) => this.events.onNotice(text),
    });

    this.whiteboards = new Whiteboards(this.scene, {
      draw: (stroke) => this.connection?.sendDraw(stroke),
      clear: (board) => this.connection?.sendClearBoard(board),
    });

    this.scene.background = new THREE.Color(0x1b1d24);
    this.scene.add(this.office, this.props.group);
    this.addLights();
    this.applyShell(DEFAULT_SCENE);
    this.applyLevel();

    this.resize();
    window.addEventListener("resize", this.resize);
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("pointerlockchange", this.onLockChange);
    canvas.addEventListener("click", this.requestLock);
    window.addEventListener("orientationchange", this.resize);
    if (this.touchMode) {
      document.addEventListener("pointerdown", this.onTouchActivity);
      this.canvasObserver = new ResizeObserver(this.resize);
      this.canvasObserver.observe(canvas);
    }

    // Only in development, and written here so the whole block is gone from the production build
    if (import.meta.env.DEV)
      void import("./e2eHook").then(({ installE2eHook }) => {
        if (this.disposed) return;
        this.removeE2eHook = installE2eHook(window.location.search, {
          pose: () => ({
            x: this.position.x,
            z: this.position.z,
            yaw: this.yaw,
            pitch: this.pitch,
          }),
          place: ({ x, z, yaw, pitch }) => {
            this.position = { x, z };
            this.yaw = yaw;
            this.pitch = pitch;
          },
          seated: () => this.seat !== null,
          renderInfo: () => this.renderer.info.render,
          remotePlayers: this.remotePlayers,
        });
      });
    this.loop();
  }

  /** Joins the multiplayer room. The office stays walkable if this fails. */
  async connect(
    name: string,
    appearance: Appearance,
    events: GameEvents,
    token: string | null = null,
    /** The floor to enter: the common one unless told another. */
    floor?: string,
  ) {
    this.events = events;
    this.area = null; // so the new listener hears where we already are
    this.zone = null;
    this.seat = null;
    this.interactAim = null;
    this.shownHint = null;
    this.panelOpen = false;
    this.chosenStatus = DEFAULT_STATUS;
    this.idle = false;
    this.lastInputAt = performance.now();
    this.setEmoteKeyHeld(false);
    events.onStatusChosen(DEFAULT_STATUS);
    events.onSeatedChange(false);
    this.awaitingSpawn = true;
    // A mute belongs to the session that was muted: a new one starts able to speak
    this.call.setMutedByModerator(false);
    const connection = await connect(
      name,
      appearance,
      {
        onSelf: (player) => {
          this.position = { x: player.x, z: player.z };
          this.yaw = player.yaw;
          this.lastSent = { x: player.x, z: player.z, yaw: player.yaw };
          this.awaitingSpawn = false;
        },
        onCorrect: ({ x, z }) => {
          // The server refused our last move: go back to where it says we are
          this.corrections++;
          this.position = { x, z };
          this.lastSent = { x, z, yaw: this.yaw };
        },
        onPlayerAdded: (id, player) => this.remotePlayers.add(id, player),
        onPlayerRemoved: (id) => this.remotePlayers.remove(id),
        onPlayers: (players, selfId) => {
          if (!this.disposed)
            events.onRoster(buildRoster(players, selfId, this.zones));
        },
        onChat: events.onChat,
        onChatRefused: (reason) => events.onNotice(CHAT_REFUSAL_TEXT[reason]),
        onKnock: ({ name, place }) =>
          events.onKnock(
            knockText(name, place ? zoneLabel(place, this.zones) : null),
          ),
        onKnocked: (ack) => events.onNotice(knockAckText(ack)),
        onVoice: (credentials) => this.call.setCredentials(credentials),
        onZone: (zone) => {
          this.zone = zone;
          this.whiteboards.setZone(zone);
          this.showScreenView();
          this.call.enteredZone(zone);
          if (!this.disposed)
            events.onZone(zone ? zoneLabel(zone, this.zones) : null);
        },
        onDraw: (stroke) => this.whiteboards.applyStroke(stroke),
        onClearBoard: (board) => this.whiteboards.clearBoard(board),
        onBoard: (board, strokes) => this.whiteboards.showBoard(board, strokes),
        onDropped: () => {
          this.reconnecting = true;
          if (!this.disposed) events.onReconnecting(true);
        },
        onReconnected: () => {
          this.reconnecting = false;
          // We may have moved while offline: report where we are now
          this.lastSent = { x: NaN, z: NaN, yaw: NaN };
          if (!this.disposed) events.onReconnecting(false);
        },
        onLook: (id, player) => this.remotePlayers.refresh(id, player),
        onStatus: (id, status) => this.remotePlayers.setStatus(id, status),
        onEmote: ({ id, emote }) => {
          if (id !== this.connection?.sessionId)
            this.remotePlayers.playEmote(id, emote);
        },
        onFloor: (floor) => {
          this.floorId = floor.id;
          if (!this.disposed) events.onFloor(floor);
        },
        onLayout: (layout) => {
          if (!this.disposed) this.applyLayout(layout);
        },
        onModerator: (can) => {
          if (!this.disposed) events.onModerator(can);
        },
        onSeated: ({ seat, x, z, yaw }) => {
          this.position = { x, z };
          if (seat) {
            this.seat = { id: seat, yaw };
            this.yaw = yaw;
            this.closeInteraction();
            this.lastSent = { x, z, yaw };
          } else {
            this.seat = null;
            // The server has our position but still the way the chair faced: say where we look
            this.lastSent = { x, z, yaw: NaN };
          }
          if (!this.disposed) events.onSeatedChange(this.seat !== null);
        },
        onSeatRefused: (reason) => {
          if (reason !== "cooldown") events.onNotice(SEAT_REFUSAL_TEXT[reason]);
          // A button is pressed once and a thumb may press it too soon: ask again when the wait is over
          else if (this.touchMode) this.standAgain();
        },
        onSeat: (id) => this.remotePlayers.applySeat(id),
        onModerated: (reply) => {
          if (!this.disposed) events.onNotice(moderationReplyText(reply));
        },
        onVoiceMuted: (muted) => {
          this.call.setMutedByModerator(muted);
          if (!this.disposed)
            events.onNotice(muted ? MUTED_NOTICE : UNMUTED_NOTICE);
        },
        onClosing: (seconds) => {
          if (!this.disposed) events.onFloorClosing(seconds);
        },
        onReopened: () => {
          if (!this.disposed) events.onFloorClosing(null);
        },
        onDisconnected: (code) => {
          this.connection = null;
          this.reconnecting = false;
          this.seat = null;
          if (!this.disposed) events.onSeatedChange(false);
          this.remotePlayers.dispose();
          this.zone = null;
          this.whiteboards.setZone(null);
          if (this.disposed) return;
          this.call.reset();
          events.onFloorClosing(null);
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
  }

  /** Draws what the server says stands in the floor, and blocks where it blocks. */
  private applyLayout(layout: LayoutMessage) {
    const key =
      layout.version === null ? "default" : `${this.floorId}:${layout.version}`;
    if (key === this.layoutKey) return;
    const floor = sceneFor(layout);
    this.applyShell(floor);
    this.scene.remove(this.office, this.props.group);
    disposeOffice(this.office);
    this.props.dispose();
    this.officeScene = floor;
    this.office = buildOffice(floor, this.officeDetail);
    this.props = loadProps(floor.models);
    this.scene.add(this.office, this.props.group);
    this.colliders = floor.colliders;
    this.interactables = floor.interactables;
    this.remotePlayers.setSeats(seatsOf(floor.interactables));
    this.interactAim = null;
    this.layoutKey = key;
  }

  /** What the shell of the floor says about the parts that are not drawn with the office: names, boards, screens and the shadow of the sun. */
  private applyShell(floor: FloorScene) {
    const { shell } = floor;
    this.zones = floor.zones;
    this.areas = floor.areas;
    // So the screen hears where we stand on this floor
    this.area = null;
    this.whiteboards.setBoards(floor.boards);
    for (const { display } of this.screens) display.dispose();
    this.screens = floor.screens.map((screen) => {
      const display = new ScreenDisplay(screen);
      this.scene.add(display.group);
      return { zone: screen.zone, display };
    });
    this.call.setScreenZones(floor.screens.map((screen) => screen.zone));
    this.showScreenView();
    this.fitSun(shell);
  }

  /** Each screen shows what is shared in its zone's call, if we are in that zone, and a note that nothing is otherwise. */
  private showScreenView() {
    for (const { zone, display } of this.screens)
      display.show(zone === this.zone ? this.screenView : { kind: "none" });
  }

  /** The sun's shadow has to cover the whole floor. */
  private fitSun(shell: { width: number; depth: number }) {
    if (!this.sun) return;
    const { camera } = this.sun.shadow;
    camera.left = -(shell.width / 2 + 1);
    camera.right = shell.width / 2 + 1;
    camera.top = shell.depth / 2 + 2;
    camera.bottom = -(shell.depth / 2 + 2);
    camera.updateProjectionMatrix();
  }

  /** Says something to everybody, to the people nearby, or (with `to`, a session id) to one person. The server decides who receives it. */
  sendChat(text: string, scope: ChatScope = "everyone", to?: string) {
    this.connection?.sendChat(text, scope, to);
  }

  /** Knocks on the private room we stand at, or on the person we face: it only tells them. */
  knock() {
    this.connection?.sendKnock();
  }

  /** Changes how we look, for everybody. The server has the last word. */
  changeLook(look: Appearance) {
    this.connection?.sendAppearance(look);
  }

  /**
   * Chooses what to show as doing. The server checks it and decides what
   * everybody sees (away and busy come from it). False when it was too soon
   * after the last change to be sent.
   */
  setStatus(status: Status): boolean {
    const now = performance.now();
    if (!this.connection || now - this.lastStatusSentAt < STATUS_SEND_GAP_MS)
      return false;
    this.lastStatusSentAt = now;
    this.chosenStatus = status;
    this.connection.sendStatus(status);
    this.events.onStatusChosen(status);
    return true;
  }

  /** Makes a gesture everybody can see. The server limits how often. */
  emote(emote: Emote) {
    if (!this.connection) return;
    this.connection.sendEmote(emote);
    this.events.onNotice(`${EMOTE_ICONS[emote]} ${EMOTE_LABELS[emote]}`);
  }

  /** Asks the server, as a moderator, to act on somebody in the room. The server decides whether we may. */
  moderate(action: ModerationAction, target: string, minutes?: number) {
    this.connection?.sendModerate(action, target, minutes);
  }

  /** Gets up from the seat, if we sit. The server puts us on our feet and says where. */
  standUp() {
    if (this.seat) this.connection?.sendStand();
  }

  /** The server made us wait a moment between sitting and getting up: asks once more after it. */
  private standAgain() {
    if (!this.seat || this.standRetry !== undefined) return;
    this.standRetry = setTimeout(() => {
      this.standRetry = undefined;
      this.standUp();
    }, STAND_RETRY_MS);
  }

  /** Whether something we used is on the screen. */
  get interactionOpen(): boolean {
    return this.panelOpen;
  }

  /** Whether what is open is for clicking and scrolling, so the mouse is not captured while it is. */
  get interactionUsesMouse(): boolean {
    return (
      this.panelOpen &&
      this.panelKind !== null &&
      panelUsesMouse(this.panelKind)
    );
  }

  closeInteraction() {
    if (!this.panelOpen) return;
    this.panelOpen = false;
    this.panelKind = null;
    this.events.onInteractPanel(null);
  }

  /** F: get up, or close what is open, or use what we look at. */
  private interact() {
    if (this.seat) return this.standUp();
    if (this.panelOpen) return this.closeInteraction();
    this.use(this.interactAim);
  }

  /** Uses a thing: sits on it, or opens what it shows. */
  private use(aim: Interactable | null) {
    if (!aim) return;
    if (aim.kind === "sit") {
      this.connection?.sendSeat(aim.id);
      return;
    }
    const panel = panelFor(aim);
    this.panelOpen = true;
    this.panelKind = panel.kind;
    this.events.onInteractPanel(panel);
  }

  /** A click does the same, except at a whiteboard, where it draws, and while sitting. */
  private interactFromClick() {
    if (this.boardAim || this.seat) return;
    this.interact();
  }

  /** The button of the touch controls: the same as F. */
  useOrStand() {
    this.interact();
  }

  /**
   * The touch controls are up: the game reads what fingers ask for from this,
   * every frame. It may be put away (null) or set again.
   */
  setTouchSource(source: TouchSource | null) {
    this.touchSource = source;
    this.touchPushing = false;
  }

  /** A quick touch on the scene, at (x, y) in the page: uses the thing under the finger, if it is within reach. */
  private tapAt(x: number, y: number) {
    if (this.boardAim || this.seat) return;
    if (this.panelOpen) return this.closeInteraction();
    const { left, top, width, height } = this.canvas.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    this.camera.updateMatrixWorld();
    this.tapRay
      .set(((x - left) / width) * 2 - 1, -((y - top) / height) * 2 + 1, 0.5)
      .unproject(this.camera)
      .sub(this.camera.position);
    const hit = aimedInteractable(
      this.interactables,
      { x: this.position.x, y: this.eyeHeight, z: this.position.z },
      this.tapRay,
      this.colliders,
    );
    this.use(hit?.interactable ?? null);
  }

  /** Leaves the office on purpose. The game is told as for any other disconnection. */
  leave() {
    this.connection?.leave();
  }

  /** How fast the view turns with the mouse, as a multiple of the usual speed. */
  setMouseSensitivity(multiplier: number) {
    this.mouseSensitivity = MOUSE_SENSITIVITY * multiplier;
  }

  diagnostics(): Diagnostics {
    const { render } = this.renderer.info;
    return {
      fps: this.fpsMeter.fps,
      worstFrameMs: this.fpsMeter.worstFrameMs,
      gpu: this.gpu,
      softwareRendering: isSoftwareRenderer(this.gpu),
      pixelRatio: this.renderer.getPixelRatio(),
      width: this.canvas.width,
      height: this.canvas.height,
      drawCalls: render.calls,
      triangles: render.triangles,
      corrections: this.corrections,
      quality: describeQuality(this.qualityChoice, this.level),
    };
  }

  /** The quality chosen in the menu: what it can change now is changed now (the edge smoothing waits for the next load). */
  setQuality(choice: QualityChoice) {
    if (choice === this.qualityChoice) return;
    this.qualityChoice = choice;
    this.updateLevel();
  }

  private updateLevel() {
    const level = resolveLevel(this.qualityChoice, {
      softwareRendering: this.softwareRendering,
      autoLevel: this.auto.level,
    });
    if (level === this.level) return;
    this.level = level;
    this.applyLevel();
  }

  private applyLevel() {
    const { shadows, furnitureDetail, avatarDetail } =
      QUALITY_PROFILES[this.level];
    this.remotePlayers.setDetail(avatarDetail);
    if (furnitureDetail !== this.officeDetail) {
      this.scene.remove(this.office);
      disposeOffice(this.office);
      this.officeDetail = furnitureDetail;
      this.office = buildOffice(this.officeScene, furnitureDetail);
      this.scene.add(this.office);
    }
    if (this.sun) {
      this.sun.castShadow = shadows;
      if (!shadows) {
        this.sun.shadow.map?.dispose();
        this.sun.shadow.map = null;
      }
    }
    this.resize();
  }

  /** Whether the browser is asking what to share: it frees the mouse, and that is not the player asking for the menu. */
  get choosingScreen(): boolean {
    return this.call.choosingScreen;
  }

  /** Captures the mouse again, e.g. after closing the chat input. With fingers there is no mouse to capture. */
  relock() {
    this.requestLock();
  }

  /** Joins the call the first time, then mutes / unmutes the microphone. */
  toggleVoice() {
    this.call.toggleMic();
  }

  /** Joins the call (with the microphone off) the first time, then turns the camera on / off. */
  toggleCamera() {
    this.call.toggleCamera();
  }

  dispose() {
    this.disposed = true;
    this.removeE2eHook?.();
    this.call.dispose();
    this.connection?.leave();
    this.connection = null;
    this.remotePlayers.dispose();
    this.whiteboards.dispose();
    for (const { display } of this.screens) display.dispose();
    cancelAnimationFrame(this.frameId);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("orientationchange", this.resize);
    document.removeEventListener("pointerdown", this.onTouchActivity);
    this.canvasObserver?.disconnect();
    clearTimeout(this.standRetry);
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    this.canvas.removeEventListener("click", this.requestLock);
    this.props.dispose();
    this.renderer.dispose();
  }

  private addLights() {
    // The ground colour is what downward-facing surfaces (the ceiling) receive
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xa8a8b2, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(8, 12, 6);
    sun.castShadow = QUALITY_PROFILES[this.level].shadows;
    this.sun = sun;
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun);
    this.fitSun(DEFAULT_SCENE.shell);
  }

  private readonly requestLock = () => {
    // With fingers there is no mouse to capture (and some phones do not have the call at all)
    if (this.touchMode) return;
    // Already captured (a click while walking): asking again only makes the browser announce it again
    if (this.isLocked) return;
    // Returns a promise in Chromium and nothing elsewhere. It rejects when the
    // browser refuses (no focus, or re-locking too soon); the user just clicks again.
    Promise.resolve(this.canvas.requestPointerLock()).catch(() => {});
  };

  private get isLocked() {
    return document.pointerLockElement === this.canvas;
  }

  /** Whether the person is steering: the mouse is captured, or the touch controls are up and nothing covers the scene. */
  private get steering() {
    return this.isLocked || (this.touchSource?.enabled ?? false);
  }

  private setEmoteKeyHeld(held: boolean) {
    if (this.emoteKeyHeld === held) return;
    this.emoteKeyHeld = held;
    this.events.onEmoteKey(held);
  }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    this.lastInputAt = performance.now();
    if (!this.isLocked) return;
    if (!e.repeat) {
      if (MOVE_KEYS.has(e.code)) {
        this.standUp();
        this.closeInteraction();
      }
      const emote = this.emoteKeyHeld ? emoteByKey(e.code) : null;
      if (emote) this.emote(emote);
      else if (e.code === EMOTE_KEY) this.setEmoteKeyHeld(true);
      else if (e.code === STATUS_KEY) {
        const next = nextStatus(this.chosenStatus);
        if (this.setStatus(next))
          this.events.onNotice(`Status: ${STATUS_LABELS[next]}`);
      } else if (e.code === VOICE_KEY) this.toggleVoice();
      else if (e.code === CAMERA_KEY) this.toggleCamera();
      else if (e.code === SCREEN_KEY) this.call.toggleScreenShare();
      else if (e.code === KNOCK_KEY) this.knock();
      else if (e.code === MAP_KEY) this.events.onMapKey();
      else if (e.code === CLEAR_BOARD_KEY) this.whiteboards.clearAimed();
      else if (e.code === INTERACT_KEY) this.interact();
      else if (e.code === STAND_KEY) this.standUp();
      else {
        // 1..7 pick the pen
        const pen = /^Digit([1-9])$/.exec(e.code);
        if (pen) this.whiteboards.setInk(Number(pen[1]) - 1);
      }
    }
    this.keys.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.lastInputAt = performance.now();
    this.keys.delete(e.code);
    if (e.code === EMOTE_KEY) this.setEmoteKeyHeld(false);
  };

  // Keys released while the mouse was free (e.g. typing in the chat) never
  // fire keyup here, so drop them to avoid a character that walks on its own.
  private readonly onLockChange = () => {
    const locked = this.isLocked;
    const drop = shouldDropKeys(this.wasLocked, locked);
    this.wasLocked = locked;
    if (!drop) return;
    this.keys.clear();
    this.setEmoteKeyHeld(false);
    this.drawing = false;
  };

  private readonly onMouseDown = (e: MouseEvent) => {
    this.lastInputAt = performance.now();
    if (!this.isLocked || e.button !== 0) return;
    this.drawing = true;
    this.interactFromClick();
  };
  private readonly onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.drawing = false;
  };

  private readonly onMouseMove = (e: MouseEvent) => {
    this.lastInputAt = performance.now();
    if (!this.isLocked) return;
    this.turn(e.movementX, e.movementY, this.mouseSensitivity);
  };

  /** A finger touched the screen: the person is there. */
  private readonly onTouchActivity = () => {
    this.lastInputAt = performance.now();
  };

  /** Turns the view by what a pointer moved, in pixels. */
  private turn(dx: number, dy: number, sensitivity: number) {
    const view = turnView(
      { yaw: this.yaw, pitch: this.pitch },
      dx,
      dy,
      sensitivity,
      this.seat ? this.seat.yaw : null,
    );
    this.yaw = view.yaw;
    this.pitch = view.pitch;
  }

  /** What fingers ask for this frame: turning, getting up by pushing the joystick, and taps. */
  private readTouch() {
    const touch = this.touchSource;
    if (!touch) return;
    if (!touch.enabled) {
      this.touchPushing = false;
      return;
    }
    const { dx, dy } = touch.takeLook();
    if (dx !== 0 || dy !== 0) {
      this.turn(dx, dy, this.mouseSensitivity * TOUCH_LOOK_GAIN);
      this.lastInputAt = performance.now();
    }
    const { forward, strafe } = touch.intent();
    const pushing = forward !== 0 || strafe !== 0;
    // Like the first press of W A S D: it gets us up from a seat and puts away what we read
    if (pushing && !this.touchPushing) {
      this.standUp();
      this.closeInteraction();
    }
    if (pushing) this.lastInputAt = performance.now();
    this.touchPushing = pushing;
    const tap = touch.takeTap();
    if (tap) this.tapAt(tap.x, tap.y);
  }

  private readonly resize = () => {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.renderer.setPixelRatio(
      pixelRatioFor(this.level, window.devicePixelRatio),
    );
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private update(dt: number) {
    this.readTouch();
    if (this.steering && !this.seat) {
      const step = moveStep(
        this.isLocked
          ? keyIntent(this.keys)
          : (this.touchSource?.intent() ?? keyIntent(this.keys)),
        this.yaw,
      );
      if (step)
        this.position = moveWithCollisions(
          this.position,
          { x: step.dx * dt, z: step.dz * dt },
          this.colliders,
          PLAYER_RADIUS,
        );
    }

    this.eyeHeight = lerp(
      this.eyeHeight,
      this.seat ? SEATED_EYE_HEIGHT : STANDING_EYE_HEIGHT,
      1 - Math.exp(-EYE_EASING * dt),
    );
    this.camera.position.set(this.position.x, this.eyeHeight, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");

    this.remotePlayers.update(dt, {
      x: this.position.x,
      z: this.position.z,
      frame: this.frame,
      profile: QUALITY_PROFILES[this.level],
    });
    this.updateArea();
    this.updateBoards(dt);
    this.updateInteractions();
    this.updateIdle();
    this.sendPositionIfChanged(dt);
    this.call.update(dt, this.position, (visit) =>
      this.remotePlayers.forEachPosition(visit),
    );
  }

  /** Tells the server when we stop touching anything and when we are back: it decides whether that shows as away. */
  private updateIdle() {
    if (!this.connection || this.awaitingSpawn) return;
    const idle = isIdle(this.lastInputAt, performance.now());
    if (idle === this.idle) return;
    this.idle = idle;
    this.connection.sendIdle(idle);
  }

  /** Tells the screen the name of the part of the office we stand in, when it changes. */
  private updateArea() {
    const area = areaAt(this.position.x, this.position.z, this.areas);
    if (area === this.area) return;
    this.area = area;
    this.events.onArea(area);
  }

  /** Lets the pen follow where we look, and tells the screen when we start or stop pointing at a board. */
  private updateBoards(dt: number) {
    this.camera.getWorldDirection(this.lookDirection);
    const aim = this.whiteboards.update(
      dt,
      { x: this.position.x, y: this.eyeHeight, z: this.position.z },
      this.lookDirection,
      this.drawing && this.isLocked,
    );
    if (
      aim?.board !== this.boardAim?.board ||
      aim?.ink !== this.boardAim?.ink
    ) {
      this.boardAim = aim;
      this.events.onBoardAim(aim);
    }
  }

  /** Aims at what can be used and tells the screen what clicking would do. A whiteboard in view takes the click, so no hint then. */
  private updateInteractions() {
    let aim: Interactable | null = null;
    let hint: string | null = null;
    if (this.steering && !this.boardAim) {
      if (this.seat) hint = this.touchMode ? STAND_ACTION : STAND_HINT;
      else if (!this.panelOpen) {
        const hit = aimedInteractable(
          this.interactables,
          { x: this.position.x, y: this.eyeHeight, z: this.position.z },
          this.lookDirection,
          this.colliders,
        );
        aim = hit?.interactable ?? null;
        hint = aim ? (this.touchMode ? actionFor(aim) : hintFor(aim)) : null;
      }
    }
    this.interactAim = aim;
    if (hint === this.shownHint) return;
    this.shownHint = hint;
    this.events.onInteractHint(hint);
  }

  private sendPositionIfChanged(dt: number) {
    this.sinceLastSend += dt;
    if (!this.connection || this.awaitingSpawn || this.reconnecting) return;
    if (this.seat) return;
    if (this.sinceLastSend < SEND_INTERVAL) return;

    const { x, z } = this.position;
    const { yaw } = this;
    const last = this.lastSent;
    if (x === last.x && z === last.z && yaw === last.yaw) return;

    this.connection.sendMove({ x, z, yaw });
    this.lastSent = { x, z, yaw };
    this.sinceLastSend = 0;
  }

  private readonly loop = () => {
    this.frameId = requestAnimationFrame(this.loop);
    const now = performance.now();
    const frameSeconds = (now - this.lastFrameTime) / 1000;
    this.fpsMeter.tick(frameSeconds); // the real frame time, before it is capped for physics
    const dt = Math.min(frameSeconds, 0.1);
    this.lastFrameTime = now;
    this.frame++;
    if (this.qualityChoice === "auto") {
      this.auto = stepAutoQuality(this.auto, {
        fps: this.fpsMeter.fps,
        frameSeconds,
      });
      this.updateLevel();
    }
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };
}
