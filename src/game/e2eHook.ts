import * as THREE from "three";
import type { Appearance } from "../../shared/appearance.ts";
import type { Player } from "../../shared/state.ts";
import type { Avatar } from "./avatar";

/** Where the camera is and where it looks, in the units the game uses. */
export interface E2ePose {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface E2ePlayer {
  name: string;
  look: Appearance;
  seat: string | null;
  x: number;
  z: number;
  /** Sprites on the avatar: its name tag, and one more while the icon of a gesture floats. */
  sprites: number;
}

export interface E2eStats {
  drawCalls: number;
  triangles: number;
  seated: boolean;
  players: E2ePlayer[];
}

/** What end-to-end tests may call on a development page opened with `?e2e`. */
export interface E2eApi {
  /** Walks the camera to a place and turns it, at a speed the server accepts. Rejects when it never gets there. */
  teleport: (
    x: number,
    z: number,
    yaw: number,
    pitch?: number,
  ) => Promise<void>;
  position: () => E2ePose;
  stats: () => E2eStats;
}

/** What the game lends to the hook. */
export interface E2eAccess {
  pose: () => E2ePose;
  place: (pose: E2ePose) => void;
  seated: () => boolean;
  renderInfo: () => { calls: number; triangles: number };
  /** The game's `RemotePlayers`: its map of people is private, and read here without widening the class. */
  remotePlayers: object;
}

declare global {
  interface Window {
    __e2e?: E2eApi;
  }
}

/** Slower than the fastest the server accepts, so a walk is never taken for a teleport. */
const WALK_SPEED = 6;
const MAX_STEP_SECONDS = 0.05;
const GIVE_UP_MS = 10_000;

interface RemoteEntry {
  player: Player;
  avatar: Avatar;
  look: Appearance;
}

export function e2eRequested(search: string): boolean {
  return new URLSearchParams(search).has("e2e");
}

function remoteEntries(access: E2eAccess): RemoteEntry[] {
  const entries: unknown = Reflect.get(access.remotePlayers, "players");
  return entries instanceof Map
    ? [...(entries.values() as Iterable<RemoteEntry>)]
    : [];
}

function walkTo(
  access: E2eAccess,
  x: number,
  z: number,
  yaw: number,
  pitch: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    let last = started;
    const step = (now: number) => {
      const seconds = Math.min((now - last) / 1000, MAX_STEP_SECONDS);
      last = now;
      const here = access.pose();
      const distance = Math.hypot(x - here.x, z - here.z);
      const reach = WALK_SPEED * seconds;
      if (distance <= reach) {
        access.place({ x, z, yaw, pitch });
        resolve();
        return;
      }
      if (now - started > GIVE_UP_MS) {
        reject(new Error(`Never got to ${x}, ${z}: the server moved us back`));
        return;
      }
      access.place({
        x: here.x + ((x - here.x) / distance) * reach,
        z: here.z + ((z - here.z) / distance) * reach,
        yaw,
        pitch,
      });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/**
 * Puts `window.__e2e` in the page when the address asks for it with `?e2e`,
 * and returns how to take it away. Only ever called in development.
 */
export function installE2eHook(
  search: string,
  access: E2eAccess,
  target: Window = window,
): (() => void) | null {
  if (!e2eRequested(search)) return null;
  const api: E2eApi = {
    teleport: (x, z, yaw, pitch = 0) => walkTo(access, x, z, yaw, pitch),
    position: () => ({ ...access.pose() }),
    stats: () => {
      const { calls, triangles } = access.renderInfo();
      return {
        drawCalls: calls,
        triangles,
        seated: access.seated(),
        players: remoteEntries(access).map(({ player, avatar, look }) => ({
          name: player.name,
          look: { ...look },
          seat: player.seat || null,
          x: player.x,
          z: player.z,
          sprites: avatar.root.children.filter(
            (child) => child instanceof THREE.Sprite,
          ).length,
        })),
      };
    },
  };
  target.__e2e = api;
  return () => {
    if (target.__e2e === api) delete target.__e2e;
  };
}
