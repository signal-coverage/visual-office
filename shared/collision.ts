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
