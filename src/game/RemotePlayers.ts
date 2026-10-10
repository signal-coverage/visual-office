import * as THREE from "three";
import type { Player } from "../../shared/state.ts";
import { createAvatar, type Avatar } from "./avatar";
import { lerp, lerpAngle } from "./math";

const SMOOTHING = 12;
/** Below this the avatar is considered standing (network smoothing never fully settles). */
const STILL_SPEED = 0.05;

interface RemotePlayer {
  player: Player;
  avatar: Avatar;
}

/** Renders other players as animated avatars, smoothing network updates. */
export class RemotePlayers {
  private readonly players = new Map<string, RemotePlayer>();
  /** Camera feeds that arrived before (or after) their player; applied whenever both exist. */
  private readonly videos = new Map<string, HTMLVideoElement>();
  private readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  add(sessionId: string, player: Player) {
    if (this.players.has(sessionId)) return;

    const avatar = createAvatar(player.name);
    avatar.root.position.set(player.x, 0, player.z);
    avatar.root.rotation.y = player.yaw;
    this.scene.add(avatar.root);
    this.players.set(sessionId, { player, avatar });
    avatar.setVideo(this.videos.get(sessionId) ?? null);
  }

  remove(sessionId: string) {
    const entry = this.players.get(sessionId);
    if (!entry) return;
    this.scene.remove(entry.avatar.root);
    entry.avatar.dispose();
    this.players.delete(sessionId);
  }

  setVideo(sessionId: string, element: HTMLVideoElement | null) {
    if (element) this.videos.set(sessionId, element);
    else this.videos.delete(sessionId);
    this.players.get(sessionId)?.avatar.setVideo(element);
  }

  update(dt: number) {
    if (dt <= 0) return;
    const t = 1 - Math.exp(-SMOOTHING * dt);
    for (const { player, avatar } of this.players.values()) {
      const { root } = avatar;
      const fromX = root.position.x;
      const fromZ = root.position.z;
      root.position.x = lerp(fromX, player.x, t);
      root.position.z = lerp(fromZ, player.z, t);
      root.rotation.y = lerpAngle(root.rotation.y, player.yaw, t);

      const speed =
        Math.hypot(root.position.x - fromX, root.position.z - fromZ) / dt;
      avatar.update(dt, speed < STILL_SPEED ? 0 : speed);
    }
  }

  /** Latest server-reported positions, which is what proximity audio uses. */
  forEachPosition(callback: (sessionId: string, x: number, z: number) => void) {
    for (const [id, { player }] of this.players)
      callback(id, player.x, player.z);
  }

  dispose() {
    for (const id of [...this.players.keys()]) this.remove(id);
  }
}
