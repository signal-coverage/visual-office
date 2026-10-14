import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { partGeometry } from "./avatarMesh";
import type { Placed } from "./avatarLook";

const piece = (overrides: Partial<Placed> = {}): Placed => ({
  anchor: "torso",
  size: [0.2, 0.4, 0.1],
  at: [0, 1, 0],
  color: 0xff8000,
  fine: false,
  body: false,
  ...overrides,
});

describe("partGeometry", () => {
  it("is nothing when there is nothing to draw", () => {
    expect(partGeometry([])).toBeNull();
  });

  it("makes one box of twelve triangles for each piece, in one geometry", () => {
    const geometry = partGeometry([piece(), piece({ at: [0.5, 1, 0] })])!;
    expect(geometry.index!.count / 3).toBe(24);
  });

  it("puts every box where its piece says, in the part's own frame", () => {
    const geometry = partGeometry([
      piece({ at: [0, 1, 0], size: [0.2, 0.4, 0.1] }),
    ])!;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.x).toBeCloseTo(-0.1);
    expect(box.min.y).toBeCloseTo(0.8);
    expect(box.min.z).toBeCloseTo(-0.05);
    expect(box.max.y).toBeCloseTo(1.2);
  });

  it("turns a piece by its rotation", () => {
    const upright = partGeometry([piece({ at: [0, 0, 0] })])!;
    const turned = partGeometry([
      piece({ at: [0, 0, 0], rot: [0, 0, Math.PI / 2] }),
    ])!;
    upright.computeBoundingBox();
    turned.computeBoundingBox();
    expect(upright.boundingBox!.max.y).toBeCloseTo(0.2);
    expect(turned.boundingBox!.max.y).toBeCloseTo(0.1);
    expect(turned.boundingBox!.max.x).toBeCloseTo(0.2);
  });

  it("paints each piece with its own colour as vertex colours, so one material serves all", () => {
    const geometry = partGeometry([
      piece({ color: 0xff0000 }),
      piece({ color: 0x0000ff, at: [1, 1, 0] }),
    ])!;
    const colors = geometry.getAttribute("color");
    const red = new THREE.Color(0xff0000);
    const blue = new THREE.Color(0x0000ff);
    expect(colors.getX(0)).toBeCloseTo(red.r);
    expect(colors.getZ(0)).toBeCloseTo(red.b);
    const last = colors.count - 1;
    expect(colors.getZ(last)).toBeCloseTo(blue.b);
    expect(colors.getX(last)).toBeCloseTo(blue.r);
  });

  it("carries only what the shared material uses, so geometries can merge", () => {
    const geometry = partGeometry([piece()])!;
    expect(Object.keys(geometry.attributes).sort()).toEqual([
      "color",
      "normal",
      "position",
    ]);
  });
});
