import { describe, expect, it } from "vitest";
import { moveWithCollisions } from "./collision.ts";
import {
  MOVE_SEND_RATE,
  PLAYER_RADIUS,
  RUN_SPEED,
  WALK_SPEED,
} from "./constants.ts";
import { OFFICE_COLLIDERS } from "./layout.ts";
import { MovementValidator } from "./movementValidator.ts";
import { randomSpawn } from "./spawn.ts";

/**
 * A player who moves exactly like the real client (same collision code, same
 * 15 Hz reporting) must never be told they are somewhere impossible. A false
 * rejection snaps them back, which feels like stutter every time they touch
 * furniture.
 */
function playLegitimately(fps: number, seconds: number, seed: number) {
  let state = seed;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };

  const spawn = randomSpawn(rand);
  const referee = new MovementValidator(spawn, 0, OFFICE_COLLIDERS);
  const dt = 1 / fps;
  let pos = { ...spawn };
  let yaw = -Math.PI / 2;
  let t = 0;
  let sinceSend = 0;
  let nextChange = 0;
  let forward = 1;
  let strafe = 0;
  let running = false;
  let reported = 0;
  const rejections: string[] = [];

  while (t < seconds) {
    if (t >= nextChange) {
      // a new decision every 0.3 to 1.5 s, like a person
      forward = [1, 1, 1, 0, -1][Math.floor(rand() * 5)];
      strafe = [0, 0, 1, -1][Math.floor(rand() * 4)];
      running = rand() < 0.4;
      yaw += (rand() - 0.5) * 2.2;
      nextChange = t + 0.3 + rand() * 1.2;
    }
    const length = Math.hypot(forward, strafe);
    if (length > 0) {
      const speed = running ? RUN_SPEED : WALK_SPEED;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      pos = moveWithCollisions(
        pos,
        {
          x: ((-sin * forward + cos * strafe) / length) * speed * dt,
          z: ((-cos * forward - sin * strafe) / length) * speed * dt,
        },
        OFFICE_COLLIDERS,
        PLAYER_RADIUS,
      );
    }
    t += dt;
    sinceSend += dt;
    if (sinceSend >= 1 / MOVE_SEND_RATE) {
      sinceSend = 0;
      reported++;
      const verdict = referee.validate(pos, Math.round(t * 1000));
      if (!verdict.ok) {
        rejections.push(
          `${verdict.reason} at ${t.toFixed(2)}s: (${referee.position.x}, ${referee.position.z}) -> (${pos.x}, ${pos.z})`,
        );
        pos = { ...referee.position }; // the client snaps back, like the real game
      }
    }
  }
  return { reported, rejections };
}

describe("MovementValidator with a legitimate player", () => {
  it.each([30, 60, 100, 144])(
    "never rejects real client movement at %i fps",
    (fps) => {
      let reported = 0;
      const rejections: string[] = [];
      for (let player = 0; player < 40; player++) {
        const result = playLegitimately(fps, 30, 1000 + player);
        reported += result.reported;
        rejections.push(...result.rejections);
      }
      expect(reported).toBeGreaterThan(10_000);
      expect(rejections.slice(0, 3)).toEqual([]);
    },
  );
});
