import * as THREE from "three";
import { sameAppearance, type Appearance } from "../../shared/appearance.ts";
import type { Emote } from "../../shared/emotes.ts";
import { asStatus, type Status } from "../../shared/presence.ts";
import type { Player } from "../../shared/state.ts";
import { createAvatar, type Avatar } from "./avatar";
import { lerp, lerpAngle } from "./math";
import { farUpdateDue, type QualityProfile } from "./quality";

const SMOOTHING = 12;
/** Below this the avatar is considered standing (network smoothing never fully settles). */
const STILL_SPEED = 0.05;

interface RemotePlayer {
  player: Player;
  avatar: Avatar;
  /** The look the avatar was made with: to tell when it has to be made again. */
  look: Appearance;
  status: Status;
  /** Time that went by while this person was not moved (far away, on low quality). */
  pendingSeconds: number;
}

/** Where the viewer stands and how much detail to spend on the people far from them. */
export interface UpdateView {
  x: number;
  z: number;
  frame: number;
  profile: QualityProfile;
}

const lookOf = (player: Player): Appearance => ({
  skin: player.skin,
  hairColor: player.hairColor,
  hairStyle: player.hairStyle,
  shirt: player.shirt,
  pants: player.pants,
});

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

    const look = lookOf(player);
    const status = asStatus(player.status);
    const avatar = createAvatar(player.name, look, status);
    avatar.root.position.set(player.x, 0, player.z);
    avatar.root.rotation.y = player.yaw;
    this.scene.add(avatar.root);
    this.players.set(sessionId, {
      player,
      avatar,
      look,
      status,
      pendingSeconds: 0,
    });
    avatar.setVideo(this.videos.get(sessionId) ?? null);
  }

  /** Somebody changed how they look: draw them again, where they stand, unless it is the look they already have. */
  refresh(sessionId: string, player: Player) {
    const entry = this.players.get(sessionId);
    if (!entry) return;
    const look = lookOf(player);
    if (sameAppearance(entry.look, look)) return;
    const previous = entry.avatar;
    const avatar = createAvatar(player.name, look, entry.status);
    avatar.root.position.copy(previous.root.position);
    avatar.root.rotation.y = previous.root.rotation.y;
    this.scene.add(avatar.root);
    this.scene.remove(previous.root);
    previous.dispose();
    entry.avatar = avatar;
    entry.look = look;
    avatar.setVideo(this.videos.get(sessionId) ?? null);
  }

  /** Somebody's status changed: the dot beside their name takes its colour. */
  setStatus(sessionId: string, status: Status) {
    const entry = this.players.get(sessionId);
    if (!entry || entry.status === status) return;
    entry.status = status;
    entry.avatar.setStatus(status);
  }

  /** Somebody made a gesture. */
  playEmote(sessionId: string, emote: Emote) {
    this.players.get(sessionId)?.avatar.playEmote(emote);
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

  update(frameSeconds: number, view?: UpdateView) {
    if (frameSeconds <= 0) return;
    for (const entry of this.players.values()) {
      const { player, avatar } = entry;
      const { root } = avatar;
      entry.pendingSeconds += frameSeconds;
      if (
        view &&
        !farUpdateDue(
          view.frame,
          Math.hypot(root.position.x - view.x, root.position.z - view.z),
          view.profile,
        )
      )
        continue;
      const dt = entry.pendingSeconds;
      entry.pendingSeconds = 0;
      const t = 1 - Math.exp(-SMOOTHING * dt);
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
