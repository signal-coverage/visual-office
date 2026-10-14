import * as THREE from "three";
import {
  appearanceColors,
  HAIR_STYLES,
  type Appearance,
} from "../../shared/appearance.ts";
import {
  EMOTE_DURATION_MS,
  EMOTE_ICONS,
  emoteIconState,
  type Emote,
} from "../../shared/emotes.ts";
import { STATUS_COLORS, type Status } from "../../shared/presence.ts";
import {
  ARM,
  EYES,
  faceCrop,
  HAIR,
  hairBackZ,
  hairCenter,
  HAND,
  HEAD,
  HEAD_CENTER,
  LEG,
  MIRROR_VIDEO_PANELS,
  NAME_TAG,
  SHOULDER_Y,
  TORSO,
  TORSO_CENTER,
  VIDEO_FACE,
} from "./avatarLayout";
import { emotePose } from "./emotePose";
import { STRIDE_RADIANS_PER_METER, walkPose } from "./walkPose";

export interface Avatar {
  root: THREE.Group;
  /** Advances the walk animation. `speed` is how fast the avatar is moving (m/s). */
  update: (dt: number, speed: number) => void;
  /** Shows a camera feed in place of the face, or brings the face back with null. */
  setVideo: (element: HTMLVideoElement | null) => void;
  /** Colours the dot beside the name. */
  setStatus: (status: Status) => void;
  /** Makes a gesture: the arms move and an icon floats above the head for a few seconds. */
  playEmote: (emote: Emote) => void;
  dispose: () => void;
}

const EYE_COLOR = 0x222222;
const SURFACE_ROUGHNESS = 0.7;
const DEFAULT_VIDEO_ASPECT = 4 / 3;
/** Index of the -z face of a BoxGeometry: the one that looks where the avatar looks. */
const FRONT_FACE = 5;
/** The floating icon's size, and how far above the name tag it starts. */
const EMOTE_ICON_SIZE = 0.5;
const EMOTE_ICON_START =
  NAME_TAG.center + NAME_TAG.height / 2 + EMOTE_ICON_SIZE / 2;

const LABEL_WIDTH = 256;
const LABEL_DOT_RADIUS = 9;
const LABEL_DOT_GAP = 10;
const LABEL_MAX_TEXT = 210;

function makeLabel(text: string, initial: Status) {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_WIDTH;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);

  /** The dot and the name together, in the middle of the tag. */
  const draw = (status: Status) => {
    ctx.clearRect(0, 0, LABEL_WIDTH, 64);
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.beginPath();
    ctx.roundRect(0, 8, LABEL_WIDTH, 48, 12);
    ctx.fill();
    ctx.font = "28px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    const textWidth = Math.min(ctx.measureText(text).width, LABEL_MAX_TEXT);
    const dotWidth = LABEL_DOT_RADIUS * 2 + LABEL_DOT_GAP;
    const left = (LABEL_WIDTH - dotWidth - textWidth) / 2;
    ctx.fillStyle = STATUS_COLORS[status];
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(left + LABEL_DOT_RADIUS, 32, LABEL_DOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText(text, left + dotWidth, 32, LABEL_MAX_TEXT);
    texture.needsUpdate = true;
  };
  draw(initial);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false }),
  );
  sprite.scale.set(1.6, NAME_TAG.height, 1);
  sprite.renderOrder = 1;
  sprite.position.y = NAME_TAG.center;
  return { sprite, draw };
}

/** The picture that floats above the head during a gesture. */
function makeEmoteIcon(emote: Emote) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.font =
    "96px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(EMOTE_ICONS[emote], size / 2, size / 2 + 6);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      depthTest: false,
      transparent: true,
    }),
  );
  sprite.scale.set(EMOTE_ICON_SIZE, EMOTE_ICON_SIZE, 1);
  sprite.renderOrder = 2;
  return sprite;
}

/**
 * A low-poly person built from boxes, painted and styled as `appearance` says.
 * Facing -z at rotation 0, like the camera.
 */
export function createAvatar(
  name: string,
  appearance: Appearance,
  status: Status = "available",
): Avatar {
  const { skin, hair, shirt, pants } = appearanceColors(appearance);
  const hairStyle = HAIR_STYLES[appearance.hairStyle];

  const paint = (color: THREE.ColorRepresentation) =>
    new THREE.MeshStandardMaterial({ color, roughness: SURFACE_ROUGHNESS });
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
  torso.position.y = TORSO_CENTER;

  const armL = limb(-ARM.shoulderX, SHOULDER_Y, ARM, shirt);
  const armR = limb(ARM.shoulderX, SHOULDER_Y, ARM, shirt);
  for (const arm of [armL, armR]) {
    // The hand hangs from the end of the sleeve
    const hand = box(HAND.width, HAND.height, HAND.depth, skin);
    hand.position.y = -ARM.height - HAND.height / 2;
    arm.add(hand);
  }

  const headY = HEAD_CENTER;
  const head = box(HEAD.width, HEAD.height, HEAD.depth, skin);
  head.position.y = headY;
  const hairCap = box(HAIR.width, HAIR.height, HAIR.depth, hair);
  hairCap.position.set(0, hairCenter(false), HAIR.backShift);
  hairCap.visible = hairStyle !== "none";
  // Long hair also hangs down behind the head
  const hairBack =
    hairStyle === "long"
      ? box(HAIR.back.width, HAIR.back.height, HAIR.back.depth, hair)
      : null;
  if (hairBack) {
    hairBack.position.set(0, headY + HAIR.back.dy, hairBackZ());
  }
  const eyes = EYES.xs.map((x) => {
    const eye = box(EYES.size, EYES.size, EYES.depth, EYE_COLOR);
    // The head's front faces -z; the eyes sit on it, standing out by their thickness
    eye.position.set(x, headY + EYES.dy, -HEAD.depth / 2 - EYES.depth / 2);
    eye.castShadow = false;
    return eye;
  });

  // Everything but the name tag bobs together
  const rig = new THREE.Group();
  rig.add(legL, legR, torso, armL, armR, head, hairCap, ...eyes);
  if (hairBack) rig.add(hairBack);

  const label = makeLabel(name, status);
  const root = new THREE.Group();
  root.add(rig, label.sprite);

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
    hairBack?.position.setZ(hairBackZ());
  };

  let phase = 0;
  let emote: { kind: Emote; elapsedMs: number; icon: THREE.Sprite } | null =
    null;
  const stopEmote = () => {
    if (!emote) return;
    root.remove(emote.icon);
    emote.icon.material.map?.dispose();
    emote.icon.material.dispose();
    emote = null;
    rig.rotation.y = 0;
    armL.rotation.z = 0;
    armR.rotation.z = 0;
  };
  return {
    root,
    setStatus: label.draw,
    playEmote(kind) {
      stopEmote();
      const icon = makeEmoteIcon(kind);
      icon.position.y = EMOTE_ICON_START;
      root.add(icon);
      emote = { kind, elapsedMs: 0, icon };
    },
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
      hairBack?.position.setZ(hairBackZ());
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

      if (!emote) return;
      emote.elapsedMs += dt * 1000;
      if (emote.elapsedMs >= EMOTE_DURATION_MS) {
        stopEmote();
        return;
      }
      const gesture = emotePose(emote.kind, emote.elapsedMs);
      armL.rotation.set(gesture.armL.x, 0, gesture.armL.z);
      armR.rotation.set(gesture.armR.x, 0, gesture.armR.z);
      rig.position.y += gesture.bob;
      rig.rotation.y = gesture.sway;
      const icon = emoteIconState(emote.elapsedMs);
      emote.icon.position.y = EMOTE_ICON_START + icon.lift;
      emote.icon.material.opacity = icon.opacity;
    },
    dispose() {
      stopEmote();
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
