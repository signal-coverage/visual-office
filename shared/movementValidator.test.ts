import { describe, expect, it } from "vitest";
import { moveWithCollisions, type Box } from "./collision.ts";
import { MAX_SPEED, PLAYER_RADIUS } from "./constants.ts";
import { MovementValidator } from "./movementValidator.ts";

const wall: Box = { minX: 5, maxX: 5.2, minZ: -10, maxZ: 10 };
const desk: Box = { minX: -2, maxX: 0, minZ: -1, maxZ: 1 };

const newValidator = (start = { x: 0, z: 5 }) =>
  new MovementValidator(start, 0, [wall, desk]);

describe("MovementValidator", () => {
  it("accepts a player running at full speed, sending 15 times per second", () => {
    // 1.5 s of running from the west wall: ~10 m of free floor along z = 5
    const validator = newValidator({ x: -9, z: 5 });
    let x = -9;
    for (let t = 66; t <= 1500; t += 66) {
      x += MAX_SPEED * 0.066;
      expect(validator.validate({ x, z: 5 }, t).ok, `at ${t}ms`).toBe(true);
    }
  });

  it("accepts a burst of delayed messages (network lag) that add up to a legitimate distance", () => {
    const validator = newValidator();
    // Nothing arrives for 800 ms, then five 0.4 m steps land at the same instant
    let x = 0;
    for (let i = 0; i < 5; i++) {
      x += 0.4;
      expect(validator.validate({ x, z: 5 }, 800).ok).toBe(true);
    }
  });

  it("rejects a teleport", () => {
    const validator = newValidator();
    expect(validator.validate({ x: 4, z: 5 }, 100)).toEqual({
      ok: false,
      reason: "too-fast",
    });
  });

  it("rejects a sustained speed hack even if each step looks small", () => {
    const validator = newValidator({ x: -9, z: 5 });
    let x = -9;
    let rejected = false;
    for (let t = 66; t <= 5000; t += 66) {
      x += 20 * 0.066; // twice the real top speed
      if (!validator.validate({ x: Math.min(x, 4.5), z: 5 }, t).ok) {
        rejected = true;
        break;
      }
    }
    expect(rejected).toBe(true);
  });

  it("does not let a long idle period bank enough budget to teleport across the office", () => {
    const validator = newValidator({ x: -9, z: 5 });
    expect(validator.validate({ x: 4, z: 5 }, 60_000)).toEqual({
      ok: false,
      reason: "too-fast",
    });
  });

  it("rejects ending inside furniture", () => {
    const validator = newValidator({ x: 0, z: 2 });
    expect(validator.validate({ x: -1, z: 0.5 }, 400)).toEqual({
      ok: false,
      reason: "blocked",
    });
  });

  it("accepts the exact position a well-behaved client ends up at when pressed against a wall", () => {
    const validator = newValidator({ x: 4, z: 5 });
    const pressed = moveWithCollisions(
      { x: 4, z: 5 },
      { x: 2, z: 0 },
      [wall, desk],
      PLAYER_RADIUS,
    );
    expect(validator.validate(pressed, 400).ok).toBe(true);
  });

  it("rejects crossing a thin wall even when the destination is free", () => {
    const validator = newValidator({ x: 4.4, z: 5 });
    // 0.2 m wall, player jumps from one side to the other within the speed budget
    expect(validator.validate({ x: 5.9, z: 5 }, 400)).toEqual({
      ok: false,
      reason: "blocked",
    });
  });

  it("accepts rounding the corner of a box, where the straight chord would clip it", () => {
    const chair: Box = { minX: 1.75, maxX: 2.25, minZ: 3.7, maxZ: 4.2 };
    // Pressed against the chair's lower edge, the client slides left along it (z stays put)
    // until it clears the chair, then moves up. The chord between the two reports clips
    // the chair's corner even though the player never went there.
    const from = { x: 1.43, z: 4.2 + PLAYER_RADIUS + 0.001 };
    const to = { x: 1.29, z: 4.38 };
    const validator = new MovementValidator(from, 0, [chair]);
    expect(validator.validate(to, 300).ok).toBe(true);
  });

  it("still rejects an L-shaped route through a wall", () => {
    const validator = newValidator({ x: 4.4, z: 5 });
    // Neither the straight line nor going along x then z (or z then x) avoids the wall
    expect(validator.validate({ x: 5.9, z: 6.2 }, 600)).toEqual({
      ok: false,
      reason: "blocked",
    });
  });

  it("keeps the last good position after a rejection", () => {
    const validator = newValidator({ x: 0, z: 5 });
    validator.validate({ x: 30, z: 5 }, 100);
    expect(validator.position).toEqual({ x: 0, z: 5 });
    expect(validator.validate({ x: 0.5, z: 5 }, 300).ok).toBe(true);
    expect(validator.position).toEqual({ x: 0.5, z: 5 });
  });
});
