import { describe, expect, it } from "vitest";
import { OFFICE_HEIGHT, PLAYER_RADIUS } from "../../shared/constants.ts";
import {
  ARM,
  AVATAR_HEIGHT,
  EYES,
  faceCrop,
  HAIR,
  hairBackZ,
  hairCenter,
  HAND,
  HEAD,
  HEAD_CENTER,
  HEAD_TOP,
  GEAR_LIFT_ON_SCREEN,
  GEAR_TOP_LIMIT,
  SHOE,
  LEG,
  NAME_TAG,
  SHOULDER_Y,
  TORSO,
  TORSO_CENTER,
  VIDEO_FACE,
} from "./avatarLayout";

const bottom = ({ center, height }: { center: number; height: number }) =>
  center - height / 2;

describe("the blocky body", () => {
  it("is the prototype's body: legs, torso, arms with hands, box head", () => {
    expect(LEG).toEqual({ width: 0.2, height: 0.84, depth: 0.22, hipX: 0.13 });
    expect(TORSO).toEqual({ width: 0.52, height: 0.6, depth: 0.28 });
    expect(ARM).toEqual({
      width: 0.15,
      height: 0.5,
      depth: 0.18,
      shoulderX: 0.34,
    });
    expect(HAND).toEqual({ width: 0.13, height: 0.2, depth: 0.15 });
    expect(HEAD).toEqual({ width: 0.4, height: 0.42, depth: 0.38 });
    expect(HEAD_CENTER).toBeCloseTo(1.66);
    expect(HEAD_TOP).toBeCloseTo(1.95);
  });

  it("stacks up: torso on the legs, head on the torso, arms beside the torso", () => {
    expect(TORSO_CENTER - TORSO.height / 2).toBeLessThanOrEqual(LEG.height);
    // Like the prototype, a thin neck of air (at most 5 cm) separates them
    const neck =
      HEAD_CENTER - HEAD.height / 2 - (TORSO_CENTER + TORSO.height / 2);
    expect(neck).toBeGreaterThanOrEqual(0);
    expect(neck).toBeLessThanOrEqual(0.05);
    expect(ARM.shoulderX - ARM.width / 2).toBeGreaterThanOrEqual(
      TORSO.width / 2 - 1e-9,
    );
    expect(SHOULDER_Y).toBeLessThanOrEqual(TORSO_CENTER + TORSO.height / 2);
  });

  it("ends the arm with the hand, hanging at the side", () => {
    // The hand takes over where the sleeve ends
    expect(ARM.height + HAND.height).toBeCloseTo(0.7);
    expect(SHOULDER_Y - ARM.height - HAND.height).toBeGreaterThan(
      LEG.height / 2,
    );
  });

  it("puts two eyes on the front of the head, clear of its edges", () => {
    expect(EYES.xs).toHaveLength(2);
    for (const x of EYES.xs) {
      expect(Math.abs(x) + EYES.size / 2).toBeLessThan(HEAD.width / 2);
    }
    expect(HEAD_CENTER + EYES.dy + EYES.size / 2).toBeLessThan(HEAD_TOP);
  });

  it("fits the office: under the ceiling and within the collision radius", () => {
    expect(AVATAR_HEIGHT).toBeLessThan(OFFICE_HEIGHT);
    // A hand's width over the collision circle is the most it can poke into a wall
    expect(ARM.shoulderX + ARM.width / 2).toBeLessThanOrEqual(
      PLAYER_RADIUS + 0.03,
    );
  });
});

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

  it("makes the screen as big as the head it replaces", () => {
    expect(VIDEO_FACE.size).toBeLessThanOrEqual(HEAD.height);
    expect(VIDEO_FACE.size).toBeGreaterThanOrEqual(HEAD.width - 1e-9);
    expect(VIDEO_FACE.depth).toBeCloseTo(HEAD.depth);
  });

  it("is big enough to recognise somebody", () => {
    expect(VIDEO_FACE.size).toBeGreaterThanOrEqual(0.28);
  });
});

describe("the hair on the head", () => {
  const capFront = HAIR.backShift - HAIR.depth / 2;

  it("sticks out of the head by about 1 cm on every side, front included, so no face of the hair is level with a face of the head", () => {
    const headFront = -HEAD.depth / 2;
    const overhang = {
      sides: (HAIR.width - HEAD.width) / 2,
      front: headFront - capFront,
    };
    for (const side of Object.values(overhang)) {
      expect(side).toBeGreaterThanOrEqual(0.008);
      expect(side).toBeLessThanOrEqual(0.015);
    }
  });

  it("makes the slab of long hair end flush with the back of the cap, so there is no step", () => {
    const capBack = HAIR.backShift + HAIR.depth / 2;
    expect(hairBackZ() + HAIR.back.depth / 2).toBeCloseTo(capBack);
  });
});

describe("long hair", () => {
  it("touches the back of the head, with or without a camera on it", () => {
    const headBack = (onScreen: boolean) =>
      onScreen ? VIDEO_FACE.depth / 2 : HEAD.depth / 2;
    for (const onScreen of [false, true]) {
      const slabFront = hairBackZ() - HAIR.back.depth / 2;
      // It sinks a little into the head (so no gap) but does not go through it
      expect(slabFront).toBeLessThanOrEqual(headBack(onScreen));
      expect(slabFront).toBeGreaterThan(headBack(onScreen) - 0.05);
    }
  });

  it("is hidden behind the head, not wider than it", () => {
    expect(HAIR.back.width).toBeLessThanOrEqual(HEAD.width * 1.1 + 1e-9);
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

describe("the shoes", () => {
  it("are a little wider than the leg and reach forward, where the avatar looks", () => {
    expect(SHOE.width).toBeGreaterThan(LEG.width);
    expect(SHOE.width - LEG.width).toBeLessThanOrEqual(0.04);
    expect(SHOE.depth).toBeGreaterThan(LEG.depth);
    // Front is -z: the toe goes past the front of the leg more than the heel goes past its back
    expect(SHOE.dz - SHOE.depth / 2).toBeLessThan(-LEG.depth / 2);
    expect(SHOE.dz + SHOE.depth / 2).toBeGreaterThanOrEqual(
      LEG.depth / 2 - 0.02,
    );
  });

  it("stay within the feet of the person: not wider than the hips, not tall as a boot", () => {
    expect(SHOE.height).toBeLessThanOrEqual(0.12);
    expect(LEG.hipX + SHOE.width / 2).toBeLessThanOrEqual(TORSO.width / 2);
    expect(Math.abs(SHOE.dz) + SHOE.depth / 2).toBeLessThanOrEqual(
      PLAYER_RADIUS,
    );
  });
});

describe("what sits over the hair", () => {
  it("is lifted with the hair when a camera takes the head", () => {
    expect(GEAR_LIFT_ON_SCREEN).toBeCloseTo(
      hairCenter(true) - hairCenter(false),
    );
  });

  it("ends under the name tag, even lifted", () => {
    expect(GEAR_TOP_LIMIT + GEAR_LIFT_ON_SCREEN).toBeLessThanOrEqual(
      bottom(NAME_TAG) + 1e-9,
    );
    expect(GEAR_TOP_LIMIT).toBeGreaterThan(HEAD_TOP);
  });
});
