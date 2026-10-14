export interface Vec2 {
  x: number;
  z: number;
}

export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const MAX_STEP = 0.1;

function overlaps(p: Vec2, radius: number, b: Box): boolean {
  return (
    p.x + radius > b.minX &&
    p.x - radius < b.maxX &&
    p.z + radius > b.minZ &&
    p.z - radius < b.maxZ
  );
}

function pushOutOnAxis(
  p: Vec2,
  axis: "x" | "z",
  delta: number,
  radius: number,
  boxes: Box[],
): number {
  const moved = { ...p, [axis]: p[axis] + delta };
  let value = moved[axis];
  for (const b of boxes) {
    if (!overlaps({ ...moved, [axis]: value }, radius, b)) continue;
    const min = axis === "x" ? b.minX : b.minZ;
    const max = axis === "x" ? b.maxX : b.maxZ;
    value = delta > 0 ? min - radius : max + radius;
  }
  return value;
}

/**
 * Moves a circle (the player) on the XZ plane. Each axis is resolved
 * separately so the player slides along walls, and long moves are split into
 * small steps so thin walls cannot be skipped.
 */
export function moveWithCollisions(
  from: Vec2,
  delta: Vec2,
  boxes: Box[],
  radius: number,
): Vec2 {
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / MAX_STEP));
  const stepX = delta.x / steps;
  const stepZ = delta.z / steps;
  let pos = { ...from };
  for (let i = 0; i < steps; i++) {
    pos = { x: pushOutOnAxis(pos, "x", stepX, radius, boxes), z: pos.z };
    pos = { x: pos.x, z: pushOutOnAxis(pos, "z", stepZ, radius, boxes) };
  }
  return pos;
}

/** How far inside a box a point may be, or outside, and still count as standing in it. */
const ENDPOINT_MARGIN = 0.06;
/** A box is a hair smaller when a line grazes it, so touching a wall is not crossing it. */
const GRAZE = 0.02;

function contains(b: Box, p: Vec2, margin: number): boolean {
  return (
    p.x >= b.minX - margin &&
    p.x <= b.maxX + margin &&
    p.z >= b.minZ - margin &&
    p.z <= b.maxZ + margin
  );
}

function crosses(a: Vec2, b: Vec2, box: Box): boolean {
  let enter = 0;
  let leave = 1;
  const axes = [
    [a.x, b.x - a.x, box.minX + GRAZE, box.maxX - GRAZE],
    [a.z, b.z - a.z, box.minZ + GRAZE, box.maxZ - GRAZE],
  ] as const;
  for (const [start, delta, min, max] of axes) {
    if (min >= max) return false;
    if (Math.abs(delta) < 1e-9) {
      if (start < min || start > max) return false;
      continue;
    }
    const t1 = (min - start) / delta;
    const t2 = (max - start) / delta;
    enter = Math.max(enter, Math.min(t1, t2));
    leave = Math.min(leave, Math.max(t1, t2));
    if (enter > leave) return false;
  }
  return true;
}

/**
 * Whether something solid lies between two points on the floor. A box that
 * either end stands in is the thing being reached (the chair you sit on, the
 * desk you look at), so it does not count.
 */
export function segmentBlocked(a: Vec2, b: Vec2, boxes: Box[]): boolean {
  return boxes.some(
    (box) =>
      !contains(box, a, ENDPOINT_MARGIN) &&
      !contains(box, b, ENDPOINT_MARGIN) &&
      crosses(a, b, box),
  );
}
