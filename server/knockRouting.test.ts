import { describe, expect, it } from "vitest";
import { KNOCK_AIM_DISTANCE, KNOCK_DOOR_DISTANCE } from "../shared/knock.ts";
import { ZONES } from "../shared/zones.ts";
import { routeKnock, type KnockPeer } from "./knockRouting.ts";

const room = ZONES[0];
const inside = {
  x: (room.area.minX + room.area.maxX) / 2,
  z: room.area.minZ + 1,
};
/** A point `gap` meters outside the room's east wall. */
const outsideEast = (gap: number) => ({ x: room.area.maxX + gap, z: inside.z });

/** Facing west: forward is (-sin yaw, -cos yaw), so yaw = pi/2 looks toward -x. */
const WEST = Math.PI / 2;
const EAST = -Math.PI / 2;

const peer = (id: string, over: Partial<KnockPeer> = {}): KnockPeer => ({
  id,
  x: 0,
  z: 0,
  yaw: 0,
  zone: null,
  status: "available",
  ...over,
});

describe("routeKnock at a private room", () => {
  it("tells the people inside when somebody is at its boundary", () => {
    const peers = [
      peer("ana", { ...outsideEast(1), yaw: EAST }),
      peer("beto", { ...inside, zone: room.id }),
      peer("carla", { ...inside, zone: room.id }),
      peer("dani", { x: 40, z: 40 }),
    ];
    const route = routeKnock("ana", peers);
    expect(route?.zone).toBe(room.id);
    expect(route?.notify.sort()).toEqual(["beto", "carla"]);
  });

  it("does not tell the people inside when the sender is far from the room", () => {
    const peers = [
      peer("ana", outsideEast(KNOCK_DOOR_DISTANCE + 1)),
      peer("beto", { x: inside.x, z: inside.z + 1, zone: room.id }),
    ];
    expect(routeKnock("ana", peers)).toBeNull();
  });

  it("skips people who asked not to be disturbed, but still counts that somebody is there", () => {
    const peers = [
      peer("ana", outsideEast(1)),
      peer("beto", { ...inside, zone: room.id, status: "dnd" }),
      peer("carla", { ...inside, zone: room.id, status: "busy" }),
    ];
    const route = routeKnock("ana", peers);
    expect(route?.notify).toEqual(["carla"]);
    expect(route?.present).toBe(2);
  });

  it("is a knock nobody hears when everybody inside is do-not-disturb", () => {
    const peers = [
      peer("ana", outsideEast(1)),
      peer("beto", { ...inside, zone: room.id, status: "dnd" }),
    ];
    const route = routeKnock("ana", peers);
    expect(route?.notify).toEqual([]);
    expect(route?.present).toBe(1);
  });

  it("is nothing when the room is empty and nobody is in front of the sender", () => {
    expect(routeKnock("ana", [peer("ana", outsideEast(1))])).toBeNull();
  });

  it("does not make people inside knock on themselves", () => {
    const peers = [
      peer("ana", { ...inside, zone: room.id }),
      peer("beto", { x: inside.x, z: inside.z + 1, zone: room.id }),
    ];
    expect(routeKnock("ana", peers)).toBeNull();
  });
});

describe("routeKnock at a person", () => {
  const ana = peer("ana", { x: 0, z: 0, yaw: WEST });

  it("reaches the person in front, within a few meters", () => {
    const route = routeKnock("ana", [
      ana,
      peer("beto", { x: -(KNOCK_AIM_DISTANCE - 0.5), z: 0 }),
    ]);
    expect(route).toEqual({ zone: null, notify: ["beto"], present: 1 });
  });

  it("does not reach somebody too far away", () => {
    expect(
      routeKnock("ana", [ana, peer("beto", { x: -(KNOCK_AIM_DISTANCE + 1) })]),
    ).toBeNull();
  });

  it("does not reach somebody behind or to the side", () => {
    expect(routeKnock("ana", [ana, peer("beto", { x: 1.5 })])).toBeNull();
    expect(routeKnock("ana", [ana, peer("beto", { x: 0, z: 1.5 })])).toBeNull();
  });

  it("picks the nearest of several in front", () => {
    const route = routeKnock("ana", [
      ana,
      peer("far", { x: -2.5 }),
      peer("near", { x: -1 }),
    ]);
    expect(route?.notify).toEqual(["near"]);
  });

  it("does not reach somebody who asked not to be disturbed", () => {
    const route = routeKnock("ana", [
      ana,
      peer("beto", { x: -1, status: "dnd" }),
    ]);
    expect(route).toEqual({ zone: null, notify: [], present: 1 });
  });

  it("does not reach through the wall of a private room", () => {
    const sender = peer("ana", {
      ...outsideEast(KNOCK_DOOR_DISTANCE + 0.3),
      yaw: WEST,
    });
    const target = peer("beto", {
      x: sender.x - 1,
      z: sender.z,
      zone: room.id,
    });
    expect(routeKnock("ana", [sender, target])).toBeNull();
  });

  it("works between people inside the same room", () => {
    const route = routeKnock("ana", [
      peer("ana", { ...inside, zone: room.id, yaw: WEST }),
      peer("beto", { x: inside.x - 1, z: inside.z, zone: room.id }),
    ]);
    expect(route?.notify).toEqual(["beto"]);
  });
});

describe("routeKnock", () => {
  it("is nothing for a sender who is not in the room", () => {
    expect(routeKnock("ghost", [peer("ana")])).toBeNull();
  });
});
