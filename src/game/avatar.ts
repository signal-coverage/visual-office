import * as THREE from "three";
import {
  appearanceColors,
  HAIR_STYLES,
  type Appearance,
} from "../../shared/appearance.ts";
import {
  faceCrop,
  HAIR,
  hairBackZ,
  hairCenter,
  HEAD_CENTER,
  HEAD_RADIUS,
  LEG,
  MIRROR_VIDEO_PANELS,
  NAME_TAG,
  TORSO,
  VIDEO_FACE,
} from "./avatarLayout";
import { STRIDE_RADIANS_PER_METER, walkPose } from "./walkPose";

export interface Avatar {
  root: THREE.Group;
  /** Advances the walk animation. `speed` is how fast the avatar is moving (m/s). */
  update: (dt: number, speed: number) => void;
  /** Shows a camera feed in place of the face, or brings the face back with null. */
  setVideo: (element: HTMLVideoElement | null) => void;
  dispose: () => void;
}

const EYE_COLOR = 0x151515;

const ARM = { width: 0.12, height: 0.58, depth: 0.14, shoulderX: 0.3 };
const DEFAULT_VIDEO_ASPECT = 4 / 3;
/** Index of the -z face of a BoxGeometry: the one that looks where the avatar looks. */
const FRONT_FACE = 5;

function makeLabel(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.beginPath();
  ctx.roundRect(0, 8, 256, 48, 12);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "28px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 32, 240);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      depthTest: false,
    }),
  );
  sprite.scale.set(1.6, NAME_TAG.height, 1);
  sprite.renderOrder = 1;
  sprite.position.y = NAME_TAG.center;
  return sprite;
}

/**
 * A low-poly person built from boxes, painted and styled as `appearance` says.
 * Facing -z at rotation 0, like the camera.
 */
export function createAvatar(name: string, appearance: Appearance): Avatar {
  const { skin, hair, shirt, pants } = appearanceColors(appearance);
  const hairStyle = HAIR_STYLES[appearance.hairStyle];

  const paint = (color: THREE.ColorRepresentation) =>
    new THREE.MeshStandardMaterial({ color });
  const box = (
    w: number,
    h: number,
    d: number,
    color: THREE.ColorRepresentation,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paint(color));
    mesh.castShadow = true;
    return mesh;
  };

  /** A limb that rotates around its top edge, like a hip or shoulder joint. */
  const limb = (
    x: number,
    y: number,
    size: { width: number; height: number; depth: number },
    color: THREE.ColorRepresentation,
  ) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = box(size.width, size.height, size.depth, color);
    mesh.position.y = -size.height / 2;
    pivot.add(mesh);
    return pivot;
  };

  const legL = limb(-LEG.hipX, LEG.height, LEG, pants);
  const legR = limb(LEG.hipX, LEG.height, LEG, pants);

  const torso = box(TORSO.width, TORSO.height, TORSO.depth, shirt);
  torso.position.y = LEG.height + TORSO.height / 2;

  const shoulderY = LEG.height + TORSO.height - 0.04;
  const armL = limb(-ARM.shoulderX, shoulderY, ARM, shirt);
  const armR = limb(ARM.shoulderX, shoulderY, ARM, shirt);
  for (const arm of [armL, armR]) {
    const hand = box(0.11, 0.12, 0.13, skin);
    hand.position.y = -ARM.height + 0.04;
    arm.add(hand);
  }

  const headY = HEAD_CENTER;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(HEAD_RADIUS, 14, 12),
    paint(skin),
  );
  head.position.y = headY;
  head.castShadow = true;
  const hairCap = box(HEAD_RADIUS * 2.1, HAIR.height, HEAD_RADIUS * 2.1, hair);
  hairCap.position.y = hairCenter(false);
  hairCap.visible = hairStyle !== "none";
  // Long hair also hangs down behind the head
  const hairBack =
    hairStyle === "long"
      ? box(HAIR.back.width, HAIR.back.height, HAIR.back.depth, hair)
      : null;
  if (hairBack) {
    hairBack.position.set(0, headY - 0.02, hairBackZ(false));
  }
  const eyes = [-0.06, 0.06].map((x) => {
    const eye = box(0.04, 0.04, 0.02, EYE_COLOR);
    eye.position.set(x, headY + 0.02, -HEAD_RADIUS + 0.005);
    eye.castShadow = false;
    return eye;
  });

  // Everything but the name tag bobs together
  const rig = new THREE.Group();
  rig.add(legL, legR, torso, armL, armR, head, hairCap, ...eyes);
  if (hairBack) rig.add(hairBack);

  const root = new THREE.Group();
  root.add(rig, makeLabel(name));

  // The face is what the camera replaces: head and eyes go, a screen takes their place
  const face = [head, ...eyes];
  let video: {
    screen: THREE.Mesh;
    texture: THREE.VideoTexture;
    stopListening: () => void;
  } | null = null;
  const clearVideo = () => {
    if (!video) return;
    rig.remove(video.screen);
    video.stopListening();
    video.texture.dispose();
    video.screen.geometry.dispose();
    for (const material of video.screen.material as THREE.Material[])
      material.dispose();
    video = null;
    for (const part of face) part.visible = true;
    hairCap.position.y = hairCenter(false);
    hairBack?.position.setZ(hairBackZ(false));
  };

  let phase = 0;
  return {
    root,
    setVideo(element) {
      clearVideo();
      if (!element) return;

      const texture = new THREE.VideoTexture(element);
      texture.colorSpace = THREE.SRGBColorSpace;
      // The skin shows on every side of the screen; the camera only on the front
      const materials: THREE.Material[] = Array.from({ length: 6 }, (_, i) =>
        i === FRONT_FACE
          ? new THREE.MeshBasicMaterial({ map: texture })
          : paint(skin),
      );
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(
          VIDEO_FACE.size,
          VIDEO_FACE.size,
          VIDEO_FACE.depth,
        ),
        materials,
      );
      screen.position.y = headY;
      screen.castShadow = true;

      // Show the middle of the picture, whatever the camera's proportions are
      const fit = () => {
        const aspect =
          element.videoWidth && element.videoHeight
            ? element.videoWidth / element.videoHeight
            : DEFAULT_VIDEO_ASPECT;
        const crop = faceCrop(aspect, MIRROR_VIDEO_PANELS);
        texture.repeat.set(...crop.repeat);
        texture.offset.set(...crop.offset);
      };
      fit();
      element.addEventListener("loadedmetadata", fit);
      element.addEventListener("resize", fit);
      void element.play().catch(() => {}); // muted, so autoplay is allowed; ignore races

      for (const part of face) part.visible = false;
      hairCap.position.y = hairCenter(true);
      hairBack?.position.setZ(hairBackZ(true));
      rig.add(screen);
      video = {
        screen,
        texture,
        stopListening: () => {
          element.removeEventListener("loadedmetadata", fit);
          element.removeEventListener("resize", fit);
        },
      };
    },
    update(dt, speed) {
      phase += speed * dt * STRIDE_RADIANS_PER_METER;
      const pose = walkPose(phase, speed);
      legL.rotation.x = pose.legL;
      legR.rotation.x = pose.legR;
      armL.rotation.x = pose.armL;
      armR.rotation.x = pose.armR;
      rig.position.y = pose.bob;
    },
    dispose() {
      clearVideo();
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        } else if (object instanceof THREE.Sprite) {
          object.material.map?.dispose();
          object.material.dispose();
        }
      });
    },
  };
}
