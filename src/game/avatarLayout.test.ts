import { describe, expect, it } from "vitest";
import { OFFICE_HEIGHT } from "../../shared/constants.ts";
import {
  faceCrop,
  HAIR,
  hairBackZ,
  hairCenter,
  HEAD_CENTER,
  HEAD_RADIUS,
  HEAD_TOP,
  NAME_TAG,
  VIDEO_FACE,
} from "./avatarLayout";

const bottom = ({ center, height }: { center: number; height: number }) =>
  center - height / 2;

describe("avatar layout, from the head up", () => {
  it("puts the name tag above the head without touching it", () => {
    expect(bottom(NAME_TAG)).toBeGreaterThanOrEqual(HEAD_TOP);
  });

  it("keeps the name tag below the ceiling, with some air", () => {
    expect(NAME_TAG.center + NAME_TAG.height / 2).toBeLessThanOrEqual(
      OFFICE_HEIGHT - 0.05,
    );
  });
});

describe("the camera in place of the face", () => {
  it("keeps the hair on top of the screen, not over the picture", () => {
    const screenTop = HEAD_CENTER + VIDEO_FACE.size / 2;
    expect(hairCenter(true) - HAIR.height / 2).toBeGreaterThanOrEqual(
      screenTop - 1e-9,
    );
  });

  it("still leaves room for the name tag above the hair", () => {
    expect(hairCenter(true) + HAIR.height / 2).toBeLessThanOrEqual(
      bottom(NAME_TAG),
    );
  });

  it("puts the hair where it always was when there is no camera", () => {
    expect(hairCenter(false) + HAIR.height / 2).toBeCloseTo(HEAD_TOP, 1);
  });

  it("is big enough to recognise somebody", () => {
    expect(VIDEO_FACE.size).toBeGreaterThanOrEqual(0.28);
  });
});

describe("long hair", () => {
  it("touches the back of the head, with or without a camera on it", () => {
    const headBack = (onScreen: boolean) =>
      onScreen ? VIDEO_FACE.depth / 2 : HEAD_RADIUS;
    for (const onScreen of [false, true]) {
      const slabFront = hairBackZ(onScreen) - HAIR.back.depth / 2;
      // It sinks a little into the head (so no gap) but does not go through it
      expect(slabFront).toBeLessThanOrEqual(headBack(onScreen));
      expect(slabFront).toBeGreaterThan(headBack(onScreen) - 0.03);
    }
  });

  it("is hidden behind the head, not wider than it", () => {
    expect(HAIR.back.width).toBeLessThanOrEqual(HEAD_RADIUS * 2.1);
  });
});

describe("faceCrop", () => {
  const apply = (
    crop: ReturnType<typeof faceCrop>,
    u: number,
    v: number,
  ): [number, number] => [
    crop.repeat[0] * u + crop.offset[0],
    crop.repeat[1] * v + crop.offset[1],
  ];

  it("cuts a wide camera picture to a square from the middle", () => {
    const crop = faceCrop(4 / 3, false);
    expect(crop.repeat[0]).toBeCloseTo(0.75);
    expect(crop.repeat[1]).toBe(1);
    // The square spans the middle three quarters of the picture
    expect(apply(crop, 0, 0.5)[0]).toBeCloseTo(0.125);
    expect(apply(crop, 1, 0.5)[0]).toBeCloseTo(0.875);
  });

  it("cuts a tall picture (a phone held upright) from the middle too", () => {
    const crop = faceCrop(3 / 4, false);
    expect(crop.repeat[0]).toBe(1);
    expect(crop.repeat[1]).toBeCloseTo(0.75);
    expect(apply(crop, 0.5, 0)[1]).toBeCloseTo(0.125);
    expect(apply(crop, 0.5, 1)[1]).toBeCloseTo(0.875);
  });

  it("leaves a square picture whole", () => {
    expect(faceCrop(1, false)).toEqual({ repeat: [1, 1], offset: [0, 0] });
  });

  it("can flip it left to right and still use the same square", () => {
    const crop = faceCrop(4 / 3, true);
    expect(apply(crop, 0, 0.5)[0]).toBeCloseTo(0.875);
    expect(apply(crop, 1, 0.5)[0]).toBeCloseTo(0.125);
  });

  it("does not break on an aspect it cannot know yet", () => {
    for (const aspect of [0, NaN, Infinity, -2]) {
      expect(faceCrop(aspect, false)).toEqual({
        repeat: [1, 1],
        offset: [0, 0],
      });
    }
  });
});
