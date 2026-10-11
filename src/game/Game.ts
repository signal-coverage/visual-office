import * as THREE from "three";
import type { ChatMessage } from "../../shared/chat.ts";
import { moveWithCollisions } from "../../shared/collision.ts";
import {
  MOVE_SEND_RATE,
  PLAYER_RADIUS,
  RUN_SPEED,
  SPAWN,
  WALK_SPEED,
} from "../../shared/constants.ts";
import { OFFICE_COLLIDERS } from "../../shared/layout.ts";
import { randomSpawn } from "../../shared/spawn.ts";
import { CallController } from "./CallController";
import { FpsMeter } from "./FpsMeter";
import { isSoftwareRenderer, readGpuName } from "./gpu";
import { connect, type Connection } from "./network";
import { zoneLabel } from "../../shared/zones.ts";
import { buildOffice } from "./office";
import { loadProps } from "./props";
import { RemotePlayers } from "./RemotePlayers";
import type { VoiceState } from "./VoiceChat";

export interface GameEvents {
  onChat: (message: ChatMessage) => void;
  onVoiceState: (state: VoiceState) => void;
  /** The name of the private zone we walked into, or null when we are back in the open office. */
  onZone: (label: string | null) => void;
  /** Our camera turned on (with a preview to show) or off (null). */
  onCamera: (on: boolean, selfView: HTMLVideoElement | null) => void;
  /** Connection lost but still retrying (true), or recovered (false). */
  onReconnecting: (reconnecting: boolean) => void;
  /** The server connection is gone for good (not called for a deliberate dispose). */
  onDisconnected: () => void;
}

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
  onZone: () => {},
  onCamera: () => {},
  onReconnecting: () => {},
  onDisconnected: () => {},
};

const SEND_INTERVAL = 1 / MOVE_SEND_RATE;
const VOICE_KEY = "KeyM";
const CAMERA_KEY = "KeyC";
const EYE_HEIGHT = 1.65;
const MOUSE_SENSITIVITY = 0.002;
const MAX_PITCH = Math.PI / 2 - 0.05;

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private lastFrameTime = performance.now();
  private readonly keys = new Set<string>();
  private readonly office = buildOffice();
  private readonly props = loadProps();
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
  private readonly fpsMeter = new FpsMeter();
  private readonly gpu: string;
  private corrections = 0;

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
    this.call = new CallController({
      onState: (state) => this.events.onVoiceState(state),
      onCamera: (on, selfView) => this.events.onCamera(on, selfView),
      onRemoteVideo: (id, element) => this.remotePlayers.setVideo(id, element),
    });

    this.scene.background = new THREE.Color(0x1b1d24);
    this.scene.add(this.office, this.props.group);
    this.addLights();

    this.resize();
    window.addEventListener("resize", this.resize);
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onLockChange);
    canvas.addEventListener("click", this.requestLock);

    this.loop();
  }

  /** Joins the multiplayer room. The office stays walkable if this fails. */
  async connect(name: string, events: GameEvents) {
    this.events = events;
    this.awaitingSpawn = true;
    const connection = await connect(name, {
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
      onChat: events.onChat,
      onVoice: (credentials) => this.call.setCredentials(credentials),
      onZone: (zone) => {
        if (!this.disposed) events.onZone(zone ? zoneLabel(zone) : null);
      },
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
      onDisconnected: () => {
        this.connection = null;
        this.reconnecting = false;
        this.remotePlayers.dispose();
        if (this.disposed) return;
        this.call.reset();
        events.onDisconnected();
      },
    });
    // dispose() may have run while we were connecting (e.g. React StrictMode)
    if (this.disposed) {
      connection.leave();
      return;
    }
    this.connection = connection;
  }

  sendChat(text: string) {
    this.connection?.sendChat(text);
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
    cancelAnimationFrame(this.frameId);
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousemove", this.onMouseMove);
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
    }
    this.keys.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  // Keys released while the mouse was free (e.g. typing in the chat) never
  // fire keyup here, so drop them to avoid a character that walks on its own.
  private readonly onLockChange = () => this.keys.clear();

  private readonly onMouseMove = (e: MouseEvent) => {
    if (!this.isLocked) return;
    this.yaw -= e.movementX * MOUSE_SENSITIVITY;
    this.pitch -= e.movementY * MOUSE_SENSITIVITY;
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
          OFFICE_COLLIDERS,
          PLAYER_RADIUS,
        );
      }
    }

    this.camera.position.set(this.position.x, EYE_HEIGHT, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");

    this.remotePlayers.update(dt);
    this.sendPositionIfChanged(dt);
    this.call.update(dt, this.position, (visit) =>
      this.remotePlayers.forEachPosition(visit),
    );
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
