import * as THREE from "three";
import { STRIDE_RADIANS_PER_METER, walkPose } from "./walkPose";

export interface Avatar {
  root: THREE.Group;
  /** Advances the walk animation. `speed` is how fast the avatar is moving (m/s). */
  update: (dt: number, speed: number) => void;
  /** Shows a camera feed floating above the name tag, or removes it with null. */
  setVideo: (element: HTMLVideoElement | null) => void;
  dispose: () => void;
}

const SKIN_TONES = [0xf1c6a0, 0xd9a06f, 0xb97d4f, 0x8a5a38];
const HAIR_COLORS = [0x2b1d14, 0x6b4a2b, 0xc9a45c, 0x111111];
const PANTS_COLOR = 0x2b3140;
const EYE_COLOR = 0x151515;

const LEG = { width: 0.17, height: 0.8, depth: 0.2, hipX: 0.11 };
const TORSO = { width: 0.46, height: 0.62, depth: 0.26 };
const ARM = { width: 0.12, height: 0.58, depth: 0.14, shoulderX: 0.3 };
const HEAD_RADIUS = 0.15;
const NAME_TAG_HEIGHT = 2.1;
const VIDEO_CENTER_HEIGHT = 2.78;
const VIDEO_PANEL_HEIGHT = 0.75;
const DEFAULT_VIDEO_ASPECT = 4 / 3;

function hashOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

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
  sprite.scale.set(1.6, 0.4, 1);
  sprite.renderOrder = 1;
  sprite.position.y = NAME_TAG_HEIGHT;
  return sprite;
}

/**
 * A low-poly person built from boxes: shirt colour, skin and hair are derived
 * from the name so everybody looks a bit different and stays recognisable.
 * Facing -z at rotation 0, like the camera.
 */
export function createAvatar(name: string): Avatar {
  const hash = hashOf(name);
  const shirt = new THREE.Color().setHSL((hash % 360) / 360, 0.6, 0.5);
  const skin = SKIN_TONES[hash % SKIN_TONES.length];
  const hair = HAIR_COLORS[(hash >>> 3) % HAIR_COLORS.length];

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

  const legL = limb(-LEG.hipX, LEG.height, LEG, PANTS_COLOR);
  const legR = limb(LEG.hipX, LEG.height, LEG, PANTS_COLOR);

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

  const headY = LEG.height + TORSO.height + HEAD_RADIUS + 0.02;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(HEAD_RADIUS, 14, 12),
    paint(skin),
  );
  head.position.y = headY;
  head.castShadow = true;
  const hairCap = box(HEAD_RADIUS * 2.1, 0.09, HEAD_RADIUS * 2.1, hair);
  hairCap.position.y = headY + HEAD_RADIUS - 0.03;
  const eyes = [-0.06, 0.06].map((x) => {
    const eye = box(0.04, 0.04, 0.02, EYE_COLOR);
    eye.position.set(x, headY + 0.02, -HEAD_RADIUS + 0.005);
    eye.castShadow = false;
    return eye;
  });

  // Everything but the name tag bobs together
  const rig = new THREE.Group();
  rig.add(legL, legR, torso, armL, armR, head, hairCap, ...eyes);

  const root = new THREE.Group();
  root.add(rig, makeLabel(name));

  let video: { sprite: THREE.Sprite; stopListening: () => void } | null = null;
  const clearVideo = () => {
    if (!video) return;
    root.remove(video.sprite);
    video.stopListening();
    video.sprite.material.map?.dispose();
    video.sprite.material.dispose();
    video = null;
  };

  let phase = 0;
  return {
    root,
    setVideo(element) {
      clearVideo();
      if (!element) return;

      const texture = new THREE.VideoTexture(element);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture }),
      );
      sprite.position.y = VIDEO_CENTER_HEIGHT;
      // Match the camera's real proportions once they are known
      const fit = () => {
        const aspect =
          element.videoWidth && element.videoHeight
            ? element.videoWidth / element.videoHeight
            : DEFAULT_VIDEO_ASPECT;
        sprite.scale.set(VIDEO_PANEL_HEIGHT * aspect, VIDEO_PANEL_HEIGHT, 1);
      };
      fit();
      element.addEventListener("loadedmetadata", fit);
      element.addEventListener("resize", fit);
      void element.play().catch(() => {}); // muted, so autoplay is allowed; ignore races

      root.add(sprite);
      video = {
        sprite,
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
