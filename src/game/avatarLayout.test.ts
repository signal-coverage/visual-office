import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { OFFICE_HEIGHT } from "../../shared/constants.ts";
import {
  HEAD_TOP,
  mirrorHorizontally,
  NAME_TAG,
  VIDEO_PANEL,
} from "./avatarLayout";

const top = ({ center, height }: { center: number; height: number }) =>
  center + height / 2;
const bottom = ({ center, height }: { center: number; height: number }) =>
  center - height / 2;

describe("avatar layout, from the head up", () => {
  it("puts the name tag above the head without touching it", () => {
    expect(bottom(NAME_TAG)).toBeGreaterThanOrEqual(HEAD_TOP);
  });

  it("stacks the video panel on top of the name tag without overlapping it", () => {
    expect(bottom(VIDEO_PANEL)).toBeGreaterThanOrEqual(top(NAME_TAG));
  });

  it("keeps the whole video panel below the ceiling, with some air", () => {
    // It used to poke 15 cm through the ceiling, which cut off its top edge
    expect(top(VIDEO_PANEL)).toBeLessThanOrEqual(OFFICE_HEIGHT - 0.05);
  });

  it("keeps the panel big enough to recognise a face", () => {
    expect(VIDEO_PANEL.height).toBeGreaterThanOrEqual(0.55);
  });
});

describe("mirrorHorizontally", () => {
  it("flips the picture left to right without cropping it", () => {
    const texture = mirrorHorizontally(new THREE.Texture());
    // u becomes 1 - u: the whole [0, 1] range is still used, just reversed
    const matrix = new THREE.Matrix3().setUvTransform(
      texture.offset.x,
      texture.offset.y,
      texture.repeat.x,
      texture.repeat.y,
      0,
      0,
      0,
    );
    const left = new THREE.Vector2(0, 0.5).applyMatrix3(matrix);
    const right = new THREE.Vector2(1, 0.5).applyMatrix3(matrix);
    expect(left.x).toBeCloseTo(1);
    expect(right.x).toBeCloseTo(0);
    expect(left.y).toBeCloseTo(0.5);
  });

  it("leaves the vertical axis alone", () => {
    const texture = mirrorHorizontally(new THREE.Texture());
    expect(texture.repeat.y).toBe(1);
    expect(texture.offset.y).toBe(0);
  });
});
