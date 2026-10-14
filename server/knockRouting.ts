import {
  KNOCK_AIM_ANGLE,
  KNOCK_AIM_DISTANCE,
  KNOCK_DOOR_DISTANCE,
} from "../shared/knock.ts";
import type { Status } from "../shared/presence.ts";
import { ZONES, type Zone } from "../shared/zones.ts";

/** One player as a knock needs to know them. */
export interface KnockPeer {
  id: string;
  x: number;
  z: number;
  /** Where they face: the camera looks toward (-sin yaw, -cos yaw). */
  yaw: number;
  /** The private zone they are in, or null for the open office. */
  zone: string | null;
  status: Status;
}

export interface KnockRoute {
  /** The private room that was knocked on, or null when it was one person. */
  zone: string | null;
  /** Who is told: everybody who is there, except the ones who asked not to be disturbed. */
  notify: string[];
  /** How many were there to be knocked on, do-not-disturb included. */
  present: number;
}

const distanceToZone = (peer: KnockPeer, zone: Zone): number => {
  const { area } = zone;
  const dx = Math.max(area.minX - peer.x, 0, peer.x - area.maxX);
  const dz = Math.max(area.minZ - peer.z, 0, peer.z - area.maxZ);
  return Math.hypot(dx, dz);
};

const tellable = (peers: readonly KnockPeer[]): string[] =>
  peers.filter((peer) => peer.status !== "dnd").map((peer) => peer.id);

/**
 * Who a knock is for, from where everybody really is (the client only says it
 * knocked). Standing at the door of a private room, it is the people inside
 * it; otherwise it is the person the sender is facing, a few meters away and
 * in the same room as the sender. Null when there is nobody to knock on. It
 * only notifies: nothing about the doors changes.
 */
export function routeKnock(
  senderId: string,
  peers: readonly KnockPeer[],
  zones: readonly Zone[] = ZONES,
): KnockRoute | null {
  const sender = peers.find((peer) => peer.id === senderId);
  if (!sender) return null;

  if (sender.zone === null) {
    const door = zones
      .map((zone) => ({ zone, distance: distanceToZone(sender, zone) }))
      .filter(({ distance }) => distance <= KNOCK_DOOR_DISTANCE)
      .sort((a, b) => a.distance - b.distance)
      .map(({ zone }) => ({
        zone,
        inside: peers.filter((peer) => peer.zone === zone.id),
      }))
      .find(({ inside }) => inside.length > 0);
    if (door)
      return {
        zone: door.zone.id,
        notify: tellable(door.inside),
        present: door.inside.length,
      };
  }

  const forwardX = -Math.sin(sender.yaw);
  const forwardZ = -Math.cos(sender.yaw);
  const aimed = peers
    .filter((peer) => peer.id !== sender.id && peer.zone === sender.zone)
    .map((peer) => {
      const dx = peer.x - sender.x;
      const dz = peer.z - sender.z;
      const distance = Math.hypot(dx, dz);
      const angle =
        distance === 0
          ? 0
          : Math.acos(
              Math.min(
                1,
                Math.max(-1, (dx * forwardX + dz * forwardZ) / distance),
              ),
            );
      return { peer, distance, angle };
    })
    .filter(
      ({ distance, angle }) =>
        distance <= KNOCK_AIM_DISTANCE && angle <= KNOCK_AIM_ANGLE,
    )
    .sort((a, b) => a.distance - b.distance)[0];
  if (!aimed) return null;
  return { zone: null, notify: tellable([aimed.peer]), present: 1 };
}
