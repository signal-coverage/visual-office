import { describe, expect, it } from "vitest";
import { RUN_SPEED, WALK_SPEED } from "../../shared/constants.ts";
import { keyIntent, moveStep, type MoveIntent } from "./moveIntent";

const keys = (...codes: string[]) => new Set(codes);
const intent = (forward: number, strafe: number, run = false): MoveIntent => ({
  forward,
  strafe,
  run,
});

describe("keyIntent", () => {
  it("is still with no key held", () => {
    expect(keyIntent(keys())).toEqual(intent(0, 0));
  });

  it("W and S are forward and backward, D and A are right and left", () => {
    expect(keyIntent(keys("KeyW"))).toEqual(intent(1, 0));
    expect(keyIntent(keys("KeyS"))).toEqual(intent(-1, 0));
    expect(keyIntent(keys("KeyD"))).toEqual(intent(0, 1));
    expect(keyIntent(keys("KeyA"))).toEqual(intent(0, -1));
    expect(keyIntent(keys("KeyW", "KeyD"))).toEqual(intent(1, 1));
  });

  it("opposite keys cancel", () => {
    expect(keyIntent(keys("KeyW", "KeyS", "KeyA", "KeyD"))).toEqual(
      intent(0, 0),
    );
  });

  it("the left Shift key runs, and nothing else does", () => {
    expect(keyIntent(keys("KeyW", "ShiftLeft")).run).toBe(true);
    expect(keyIntent(keys("KeyW", "ShiftRight")).run).toBe(false);
    expect(keyIntent(keys("KeyW")).run).toBe(false);
  });
});

describe("moveStep", () => {
  it("does not move when there is no push", () => {
    expect(moveStep(intent(0, 0), 1.2)).toBeNull();
  });

  it("walks forward along where the camera looks: -z at yaw 0", () => {
    const step = moveStep(intent(1, 0), 0)!;
    expect(step.dx).toBeCloseTo(0);
    expect(step.dz).toBeCloseTo(-WALK_SPEED);
  });

  it("strafes to the right of where the camera looks: +x at yaw 0", () => {
    const step = moveStep(intent(0, 1), 0)!;
    expect(step.dx).toBeCloseTo(WALK_SPEED);
    expect(step.dz).toBeCloseTo(0);
  });

  it("turns with the yaw", () => {
    const step = moveStep(intent(1, 0), Math.PI / 2)!;
    expect(step.dx).toBeCloseTo(-WALK_SPEED);
    expect(step.dz).toBeCloseTo(0);
  });

  it("a diagonal is no faster than a straight line", () => {
    const step = moveStep(intent(1, 1), 0.7)!;
    expect(Math.hypot(step.dx, step.dz)).toBeCloseTo(WALK_SPEED);
  });

  it("runs faster", () => {
    const step = moveStep(intent(1, 0, true), 0)!;
    expect(Math.hypot(step.dx, step.dz)).toBeCloseTo(RUN_SPEED);
  });

  it("a gentle push (a joystick) is slower, in proportion", () => {
    const step = moveStep(intent(0.5, 0), 0)!;
    expect(Math.hypot(step.dx, step.dz)).toBeCloseTo(WALK_SPEED / 2);
  });

  it("never goes faster than the speed, whatever the push", () => {
    const step = moveStep(intent(3, 4), 0)!;
    expect(Math.hypot(step.dx, step.dz)).toBeCloseTo(WALK_SPEED);
  });

  it("gives, for the keys, exactly what the game always computed", () => {
    for (const held of [
      keys("KeyW"),
      keys("KeyW", "KeyD"),
      keys("KeyS", "KeyA", "ShiftLeft"),
      keys("KeyD", "ShiftLeft"),
    ])
      for (const yaw of [0, 0.3, -2.1, 5.5]) {
        const forward = Number(held.has("KeyW")) - Number(held.has("KeyS"));
        const strafe = Number(held.has("KeyD")) - Number(held.has("KeyA"));
        const length = Math.hypot(forward, strafe);
        const speed = held.has("ShiftLeft") ? RUN_SPEED : WALK_SPEED;
        const sin = Math.sin(yaw);
        const cos = Math.cos(yaw);
        const expected = {
          dx: ((-sin * forward + cos * strafe) / length) * speed,
          dz: ((-cos * forward - sin * strafe) / length) * speed,
        };
        expect(moveStep(keyIntent(held), yaw)).toEqual(expected);
      }
  });
});
