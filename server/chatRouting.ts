import type { ChatRefusal, ChatScope } from "../shared/chat.ts";
import type { Status } from "../shared/presence.ts";
import { peerVolume } from "../shared/voice.ts";

/** One player as chat needs to know them: where they are and what they show as doing. */
export interface ChatPeer {
  id: string;
  x: number;
  z: number;
  /** The private zone they are in, or null for the open office. */
  zone: string | null;
  status: Status;
}

/** Who a message is for, as the server understood the client's request. */
export type ChatTarget =
  { scope: Exclude<ChatScope, "dm"> } | { scope: "dm"; to: string };

export interface Delivery {
  id: string;
  /** The receiver must not be alerted (a sound, a toast): their own copy, or they asked not to be disturbed. */
  quiet: boolean;
}

export type ChatRoute =
  { ok: true; deliveries: Delivery[] } | { ok: false; reason: ChatRefusal };

/**
 * Who receives a message. The server decides, from where everybody really is:
 * a client only says which kind of message it is (and, for a direct one,
 * which person), never who gets it. The sender always gets their own copy.
 *
 * Nearby follows the voice: inside a private zone it is the people in that
 * zone; in the open office it is the people who could be heard at all.
 */
export function routeChat(
  senderId: string,
  peers: readonly ChatPeer[],
  target: ChatTarget,
): ChatRoute {
  const sender = peers.find((peer) => peer.id === senderId);
  if (!sender) return { ok: false, reason: "gone" };
  const own: Delivery = { id: sender.id, quiet: true };

  if (target.scope === "dm") {
    if (target.to === sender.id) return { ok: false, reason: "self" };
    const receiver = peers.find((peer) => peer.id === target.to);
    if (!receiver) return { ok: false, reason: "gone" };
    return {
      ok: true,
      deliveries: [own, { id: receiver.id, quiet: receiver.status === "dnd" }],
    };
  }

  const others = peers.filter((peer) => peer.id !== sender.id);
  const reached =
    target.scope === "everyone"
      ? others
      : others.filter((p) => hears(sender, p));
  return {
    ok: true,
    deliveries: [
      own,
      ...reached.map((peer): Delivery => ({ id: peer.id, quiet: false })),
    ],
  };
}

/** Whether `other` is in the sender's call and close enough to be heard. */
function hears(sender: ChatPeer, other: ChatPeer): boolean {
  if (sender.zone !== other.zone) return false;
  return (
    peerVolume(
      Math.hypot(sender.x - other.x, sender.z - other.z),
      sender.zone,
    ) > 0
  );
}
