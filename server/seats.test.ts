import { describe, expect, it } from "vitest";
import type { Box } from "../shared/collision.ts";
import type { Furniture } from "../shared/furniture.ts";
import { interactablesOf, type Interactable } from "../shared/interactions.ts";
import {
  maySit,
  SEAT_REACH,
  SeatBook,
  standSpot,
  type SitContext,
} from "./seats.ts";

const chairAt = (
  x: number,
  z: number,
  rotation: Furniture["rotation"] = 0,
): Interactable =>
  interactablesOf({
    furniture: [{ kind: "chair", x, z, rotation }],
    models: [],
  })[0];

const context = (over: Partial<SitContext> = {}): SitContext => ({
  seat: chairAt(0, 0),
  player: { x: 0, z: 1.5 },
  occupiedBy: undefined,
  sessionId: "ana",
  alreadySeated: false,
  colliders: [],
  user: null,
  ...over,
});

describe("maySit", () => {
  it("lets somebody close to a free chair sit", () => {
    expect(maySit(context())).toEqual({ ok: true });
  });

  it("refuses a seat that is not in the layout", () => {
    expect(maySit(context({ seat: undefined }))).toEqual({
      ok: false,
      reason: "unknown",
    });
  });

  it("refuses something that is not a seat, like a desk", () => {
    const [desk] = interactablesOf({
      furniture: [{ kind: "desk", x: 0, z: 0, rotation: 0 }],
      models: [],
    });
    expect(maySit(context({ seat: desk }))).toEqual({
      ok: false,
      reason: "unknown",
    });
  });

  it("refuses one person already sitting", () => {
    expect(maySit(context({ alreadySeated: true }))).toEqual({
      ok: false,
      reason: "seated",
    });
  });

  it("refuses a seat somebody else has, one person per seat", () => {
    expect(maySit(context({ occupiedBy: "beto" }))).toEqual({
      ok: false,
      reason: "taken",
    });
  });

  it("treats the seat you hold as already sitting, not as free", () => {
    expect(maySit(context({ occupiedBy: "ana" }))).toEqual({
      ok: false,
      reason: "seated",
    });
  });

  it("refuses somebody too far from the seat, by where the server has them", () => {
    expect(maySit(context({ player: { x: 0, z: SEAT_REACH + 0.5 } }))).toEqual({
      ok: false,
      reason: "far",
    });
    expect(maySit(context({ player: { x: 0, z: SEAT_REACH - 0.1 } }))).toEqual({
      ok: true,
    });
  });

  it("refuses a seat on the other side of a wall, even within reach", () => {
    const wall: Box = { minX: -2, maxX: 2, minZ: 0.7, maxZ: 0.9 };
    expect(maySit(context({ colliders: [wall] }))).toEqual({
      ok: false,
      reason: "blocked",
    });
  });

  it("does not count the chair's own box as being in the way", () => {
    const own: Box = { minX: -0.25, maxX: 0.25, minZ: -0.25, maxZ: 0.25 };
    expect(maySit(context({ colliders: [own] }))).toEqual({ ok: true });
  });

  it("lets signed-in people sit as well: nothing restricts it yet", () => {
    expect(
      maySit(
        context({
          user: { id: "u", email: null, name: "Ana", isAdmin: false },
        }),
      ),
    ).toEqual({ ok: true });
  });
});

describe("SeatBook", () => {
  it("remembers who sits where, both ways", () => {
    const book = new SeatBook();
    book.take("chair:1", "ana");
    expect(book.occupant("chair:1")).toBe("ana");
    expect(book.seatOf("ana")).toBe("chair:1");
    expect(book.occupant("chair:2")).toBeUndefined();
    expect(book.seatOf("beto")).toBeUndefined();
  });

  it("releases a seat and says which it was", () => {
    const book = new SeatBook();
    book.take("chair:1", "ana");
    expect(book.release("ana")).toBe("chair:1");
    expect(book.occupant("chair:1")).toBeUndefined();
    expect(book.seatOf("ana")).toBeUndefined();
    expect(book.release("ana")).toBeUndefined();
  });

  it("refuses to give one seat to two people, or one person two seats", () => {
    const book = new SeatBook();
    expect(book.take("chair:1", "ana")).toBe(true);
    expect(book.take("chair:1", "beto")).toBe(false);
    expect(book.take("chair:2", "ana")).toBe(false);
    expect(book.occupant("chair:1")).toBe("ana");
    expect(book.occupant("chair:2")).toBeUndefined();
  });

  it("lists everybody sitting, for when the layout changes", () => {
    const book = new SeatBook();
    book.take("chair:1", "ana");
    book.take("chair:2", "beto");
    expect(book.sitters().sort()).toEqual(["ana", "beto"]);
  });
});

describe("standSpot", () => {
  const bounds: Box = { minX: -15, maxX: 15, minZ: -10, maxZ: 10 };
  const seat = chairAt(0, 0).seat!;
  const radius = 0.4;
  const free = (spot: { x: number; z: number }, boxes: Box[]) =>
    boxes.every(
      (b) =>
        !(
          spot.x + radius > b.minX &&
          spot.x - radius < b.maxX &&
          spot.z + radius > b.minZ &&
          spot.z - radius < b.maxZ
        ),
    );

  it("stands behind the chair, away from the desk it faces", () => {
    const spot = standSpot(seat, [], bounds);
    expect(spot.x).toBeCloseTo(0);
    expect(spot.z).toBeGreaterThan(0.7);
  });

  it("follows the chair's turn", () => {
    const turned = standSpot(chairAt(0, 0, 90).seat!, [], bounds);
    expect(turned.x).toBeGreaterThan(0.7);
    expect(turned.z).toBeCloseTo(0);
  });

  it("goes to the side when behind is blocked", () => {
    const behind: Box = { minX: -1, maxX: 1, minZ: 0.4, maxZ: 1.6 };
    const spot = standSpot(seat, [behind], bounds);
    expect(free(spot, [behind])).toBe(true);
  });

  it("never lands inside anything while there is room somewhere", () => {
    const boxes: Box[] = [
      { minX: -0.25, maxX: 0.25, minZ: -0.25, maxZ: 0.25 },
      { minX: -3, maxX: 3, minZ: 0.4, maxZ: 1.2 },
      { minX: 0.5, maxX: 1.5, minZ: -3, maxZ: 3 },
    ];
    const spot = standSpot(seat, boxes, bounds);
    expect(free(spot, boxes)).toBe(true);
  });

  it("does not leave the floor", () => {
    const edge = { minX: -15, maxX: 15, minZ: -10, maxZ: 1 };
    const spot = standSpot(seat, [], edge);
    expect(spot.z).toBeLessThanOrEqual(edge.maxZ - radius + 1e-9);
  });

  it("does not put somebody on the other side of a wall next to the chair", () => {
    const glass: Box = { minX: -3, maxX: 3, minZ: 0.4, maxZ: 0.55 };
    const spot = standSpot(seat, [glass], bounds);
    expect(spot.z).toBeLessThan(0.4);
  });

  it("falls back to the first spot when nothing is free", () => {
    const everything: Box = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
    const spot = standSpot(seat, [everything], bounds);
    expect(spot.x).toBeCloseTo(0);
    expect(spot.z).toBeGreaterThan(0.7);
  });
});
