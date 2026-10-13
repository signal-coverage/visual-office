import * as THREE from "three";
import type { Appearance } from "../../shared/appearance.ts";
import type { ChatMessage } from "../../shared/chat.ts";
import { moveWithCollisions } from "../../shared/collision.ts";
import {
  MOVE_SEND_RATE,
  PLAYER_RADIUS,
  RUN_SPEED,
  SPAWN,
  WALK_SPEED,
} from "../../shared/constants.ts";
import type { LayoutMessage } from "../../shared/floors.ts";
import { OFFICE_COLLIDERS, sceneFor } from "../../shared/layout.ts";
import { buildRoster, type Roster } from "../../shared/roster.ts";
import { SCREENS } from "../../shared/screens.ts";
import { randomSpawn } from "../../shared/spawn.ts";
import { zoneLabel } from "../../shared/zones.ts";
import { CallController } from "./CallController";
import { FpsMeter } from "./FpsMeter";
import { isSoftwareRenderer, readGpuName } from "./gpu";
import { connect, type Connection } from "./network";
import { buildOffice, disposeOffice } from "./office";
import { loadProps } from "./props";
import { RemotePlayers } from "./RemotePlayers";
import { ScreenDisplay } from "./ScreenDisplay";
import { Whiteboards, type BoardAim } from "./Whiteboards";
import type { VoiceState } from "./VoiceChat";

export interface GameEvents {
  onChat: (message: ChatMessage) => void;
  onVoiceState: (state: VoiceState) => void;
  /** How many bars of the microphone meter to light (0 when we are not transmitting). */
  onMicLevel: (steps: number) => void;
  /** Who is around, as the list should show it: changes when people come, go or change zone. */
  onRoster: (roster: Roster) => void;
  /** The name of the private zone we walked into, or null when we are back in the open office. */
  onZone: (label: string | null) => void;
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
  /** The floor will close for editing in this many seconds, or (null) it will not after all. */
  onFloorClosing: (seconds: number | null) => void;
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
}

const NO_EVENTS: GameEvents = {
  onChat: () => {},
  onVoiceState: () => {},
  onMicLevel: () => {},
  onRoster: () => {},
  onZone: () => {},
  onBoardAim: () => {},
  onScreenShare: () => {},
  onNotice: () => {},
  onCamera: () => {},
  onReconnecting: () => {},
  onDisconnected: () => {},
  onFloorClosing: () => {},
};

const SEND_INTERVAL = 1 / MOVE_SEND_RATE;
const VOICE_KEY = "KeyM";
const CAMERA_KEY = "KeyC";
/** Shares your screen on the wall screen of the room you are in. */
const SCREEN_KEY = "KeyP";
/** Wipes the board you are pointing at. */
const CLEAR_BOARD_KEY = "Backspace";
const EYE_HEIGHT = 1.65;
const MOUSE_SENSITIVITY = 0.002;
const MAX_PITCH = Math.PI / 2 - 0.05;

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private lastFrameTime = performance.now();
  private readonly keys = new Set<string>();
  // What stands in the floor: the default every build carries until the server says otherwise
  private office = buildOffice();
  private props = loadProps();
  private colliders = OFFICE_COLLIDERS;
  /** The stored layout version drawn now, or null for the default. */
  private layoutVersion: number | null = null;
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
  private readonly screen: ScreenDisplay;
  /** The left mouse button is down while the mouse is captured. */
  private drawing = false;
  private boardAim: BoardAim | null = null;
  private readonly lookDirection = new THREE.Vector3();
  private readonly fpsMeter = new FpsMeter();
  private readonly gpu: string;
  private corrections = 0;
  private mouseSensitivity = MOUSE_SENSITIVITY;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // On machines with two graphics cards the browser picks the weak one by default
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.gpu = readGpuName(this.renderer.getContext());
    this.renderer.shadowMap.enabled = true;
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    this.position = randomSpawn();
    this.yaw = SPAWN.yaw;
    this.remotePlayers = new RemotePlayers(this.scene);
    this.screen = new ScreenDisplay(SCREENS[0]);
    this.scene.add(this.screen.group);
    this.call = new CallController({
      onState: (state) => this.events.onVoiceState(state),
      onMicLevel: (steps) => this.events.onMicLevel(steps),
      onCamera: (on, selfView) => this.events.onCamera(on, selfView),
      onRemoteVideo: (id, element) => this.remotePlayers.setVideo(id, element),
      onScreen: (view) => {
        this.screen.show(view);
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

    this.resize();
    window.addEventListener("resize", this.resize);
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("pointerlockchange", this.onLockChange);
    canvas.addEventListener("click", this.requestLock);

    this.loop();
  }

  /** Joins the multiplayer room. The office stays walkable if this fails. */
  async connect(
    name: string,
    appearance: Appearance,
    events: GameEvents,
    token: string | null = null,
  ) {
    this.events = events;
    this.awaitingSpawn = true;
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
          if (!this.disposed) events.onRoster(buildRoster(players, selfId));
        },
        onChat: events.onChat,
        onVoice: (credentials) => this.call.setCredentials(credentials),
        onZone: (zone) => {
          this.whiteboards.setZone(zone);
          this.call.enteredZone(zone);
          if (!this.disposed) events.onZone(zone ? zoneLabel(zone) : null);
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
        onLayout: (layout) => {
          if (!this.disposed) this.applyLayout(layout);
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
          this.remotePlayers.dispose();
          this.whiteboards.setZone(null);
          if (this.disposed) return;
          this.call.reset();
          events.onFloorClosing(null);
          events.onDisconnected(code);
        },
      },
      token,
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
    if (layout.version === this.layoutVersion) return;
    const floor = sceneFor(layout);
    this.scene.remove(this.office, this.props.group);
    disposeOffice(this.office);
    this.props.dispose();
    this.office = buildOffice(floor);
    this.props = loadProps(floor.models);
    this.scene.add(this.office, this.props.group);
    this.colliders = floor.colliders;
    this.layoutVersion = layout.version;
  }

  sendChat(text: string) {
    this.connection?.sendChat(text);
  }

  /** Changes how we look, for everybody. The server has the last word. */
  changeLook(look: Appearance) {
    this.connection?.sendAppearance(look);
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
    };
  }

  /** Captures the mouse again, e.g. after closing the chat input. */
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
    this.call.dispose();
    this.connection?.leave();
    this.connection = null;
    this.remotePlayers.dispose();
    this.whiteboards.dispose();
    this.screen.dispose();
    cancelAnimationFrame(this.frameId);
    window.removeEventListener("resize", this.resize);
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
    sun.position.set(4, 8, 3);
    sun.castShadow = true;
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    this.scene.add(sun);
  }

  private readonly requestLock = () => {
    // Returns a promise in Chromium and nothing elsewhere. It rejects when the
    // browser refuses (no focus, or re-locking too soon); the user just clicks again.
    Promise.resolve(this.canvas.requestPointerLock()).catch(() => {});
  };

  private get isLocked() {
    return document.pointerLockElement === this.canvas;
  }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (!this.isLocked) return;
    if (!e.repeat) {
      if (e.code === VOICE_KEY) this.toggleVoice();
      else if (e.code === CAMERA_KEY) this.toggleCamera();
      else if (e.code === SCREEN_KEY) this.call.toggleScreenShare();
      else if (e.code === CLEAR_BOARD_KEY) this.whiteboards.clearAimed();
      else {
        // 1..7 pick the pen
        const pen = /^Digit([1-9])$/.exec(e.code);
        if (pen) this.whiteboards.setInk(Number(pen[1]) - 1);
      }
    }
    this.keys.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  // Keys released while the mouse was free (e.g. typing in the chat) never
  // fire keyup here, so drop them to avoid a character that walks on its own.
  private readonly onLockChange = () => {
    this.keys.clear();
    this.drawing = false;
  };

  private readonly onMouseDown = (e: MouseEvent) => {
    if (this.isLocked && e.button === 0) this.drawing = true;
  };
  private readonly onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.drawing = false;
  };

  private readonly onMouseMove = (e: MouseEvent) => {
    if (!this.isLocked) return;
    this.yaw -= e.movementX * this.mouseSensitivity;
    this.pitch -= e.movementY * this.mouseSensitivity;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
  };

  private readonly resize = () => {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private update(dt: number) {
    if (this.isLocked) {
      const forward =
        Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
      const strafe =
        Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
      const length = Math.hypot(forward, strafe);
      if (length > 0) {
        const speed = this.keys.has("ShiftLeft") ? RUN_SPEED : WALK_SPEED;
        const sin = Math.sin(this.yaw);
        const cos = Math.cos(this.yaw);
        // Camera looks toward (-sin, -cos) at yaw; right vector is (cos, -sin)
        const dx = (-sin * forward + cos * strafe) / length;
        const dz = (-cos * forward - sin * strafe) / length;
        this.position = moveWithCollisions(
          this.position,
          { x: dx * speed * dt, z: dz * speed * dt },
          this.colliders,
          PLAYER_RADIUS,
        );
      }
    }

    this.camera.position.set(this.position.x, EYE_HEIGHT, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");

    this.remotePlayers.update(dt);
    this.updateBoards(dt);
    this.sendPositionIfChanged(dt);
    this.call.update(dt, this.position, (visit) =>
      this.remotePlayers.forEachPosition(visit),
    );
  }

  /** Lets the pen follow where we look, and tells the screen when we start or stop pointing at a board. */
  private updateBoards(dt: number) {
    this.camera.getWorldDirection(this.lookDirection);
    const aim = this.whiteboards.update(
      dt,
      { x: this.position.x, y: EYE_HEIGHT, z: this.position.z },
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

  private sendPositionIfChanged(dt: number) {
    this.sinceLastSend += dt;
    if (!this.connection || this.awaitingSpawn || this.reconnecting) return;
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
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };
}
