import * as THREE from "three";
import { appearanceColors, type Appearance } from "../../shared/appearance.ts";
import {
  EMOTE_DURATION_MS,
  EMOTE_ICONS,
  emoteIconState,
  type Emote,
} from "../../shared/emotes.ts";
import { STATUS_COLORS, type Status } from "../../shared/presence.ts";
import {
  ARM,
  faceCrop,
  GEAR_LIFT_ON_SCREEN,
  HEAD_CENTER,
  LEG,
  MIRROR_VIDEO_PANELS,
  NAME_TAG,
  SHOE,
  SHOULDER_Y,
  VIDEO_FACE,
} from "./avatarLayout";
import { lookPieces, type Placed, type PlacedAnchor } from "./avatarLook";
import { partGeometry } from "./avatarMesh";
import type { DetailLevel } from "./furnitureLook";
import { emotePose } from "./emotePose";
import { seatedPose, type SeatedPose } from "./seatedPose";
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
  /** Sits the avatar down (with the arms to a desk, or not), or stands it up with null. */
  setSeat: (atDesk: boolean | null) => void;
  dispose: () => void;
}

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
 * Every avatar is drawn with this one material: each box carries its own colour
 * as a vertex colour (see avatarMesh.ts). It belongs to nobody, so no avatar
 * disposes it.
 */
const AVATAR_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: SURFACE_ROUGHNESS,
});

const solid = (
  size: readonly [number, number, number],
  at: readonly [number, number, number],
  color: number,
) => {
  const mesh = new THREE.Mesh(
    partGeometry([
      { anchor: "torso", size, at, color, fine: false, body: true },
    ])!,
    AVATAR_MATERIAL,
  );
  mesh.castShadow = true;
  return mesh;
};

/** The merged boxes of one part of the body, or null when the look puts nothing there. */
function partMesh(pieces: readonly Placed[], anchor: PlacedAnchor) {
  const geometry = partGeometry(pieces.filter((p) => p.anchor === anchor));
  if (!geometry) return null;
  const mesh = new THREE.Mesh(geometry, AVATAR_MATERIAL);
  mesh.castShadow = true;
  return mesh;
}

/**
 * A low-poly person built from boxes, painted and styled as `appearance` says.
 * Facing -z at rotation 0, like the camera. `detail` "low" leaves out the
 * smallest things they wear.
 */
export function createAvatar(
  name: string,
  appearance: Appearance,
  status: Status = "available",
  detail: DetailLevel = "high",
): Avatar {
  const { skin, pants, shoe } = appearanceColors(appearance);
  const pieces = lookPieces(appearance, detail);

  /** A limb that rotates around its top edge, like a hip or shoulder joint. */
  const pivot = (x: number, y: number) => {
    const group = new THREE.Group();
    group.position.set(x, y, 0);
    return group;
  };

  const legL = pivot(-LEG.hipX, LEG.height);
  const legR = pivot(LEG.hipX, LEG.height);
  const legMeshes = [legL, legR].map((leg) => {
    const mesh = solid(
      [LEG.width, LEG.height, LEG.depth],
      [0, -LEG.height / 2, 0],
      pants,
    );
    leg.add(mesh);
    return mesh;
  });
  // The shoes stand under each leg, and on the lower legs while sitting
  const standingShoes: THREE.Mesh[] = [];
  const sittingShoes: THREE.Mesh[] = [];
  const makeShoe = (y: number) =>
    solid([SHOE.width, SHOE.height, SHOE.depth], [0, y, SHOE.dz], shoe ?? 0);
  if (shoe !== null)
    for (const leg of [legL, legR]) {
      const standing = makeShoe(-LEG.height + SHOE.height / 2);
      leg.add(standing);
      standingShoes.push(standing);
    }
  // The lower legs only show while sitting: they hang straight down from the knee
  const shins = [-LEG.hipX, LEG.hipX].map((x) => {
    const group = pivot(x, LEG.height);
    group.visible = false;
    group.add(
      solid([LEG.width, LEG.height, LEG.depth], [0, -LEG.height / 2, 0], pants),
    );
    if (shoe !== null) {
      const shoeMesh = makeShoe(-LEG.height + SHOE.height / 2);
      group.add(shoeMesh);
      sittingShoes.push(shoeMesh);
    }
    return group;
  });

  const torso = partMesh(pieces, "torso");
  const arms = (["armL", "armR"] as const).map((anchor) => {
    const arm = pivot(
      anchor === "armL" ? -ARM.shoulderX : ARM.shoulderX,
      SHOULDER_Y,
    );
    const mesh = partMesh(pieces, anchor);
    if (mesh) arm.add(mesh);
    return arm;
  });
  const [armL, armR] = arms;

  // The face (head, eyes, glasses, beard) is what the camera replaces; the
  // hair and what is worn over it stay, and rise with the screen
  const faceMesh = partMesh(pieces, "face");
  const gearMesh = partMesh(pieces, "gear");

  // Everything but the name tag bobs together
  const rig = new THREE.Group();
  for (const part of [legL, legR, ...shins, torso, ...arms, faceMesh, gearMesh])
    if (part) rig.add(part);

  const label = makeLabel(name, status);
  const root = new THREE.Group();
  root.add(rig, label.sprite);

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
    if (faceMesh) faceMesh.visible = true;
    if (gearMesh) gearMesh.position.y = 0;
  };

  let phase = 0;
  let seated: SeatedPose | null = null;
  const setSeat = (atDesk: boolean | null) => {
    seated = atDesk === null ? null : seatedPose(atDesk);
    const thigh = seated?.thighShare ?? 1;
    for (const mesh of legMeshes) {
      mesh.scale.y = thigh;
      mesh.position.y = -(LEG.height * thigh) / 2;
    }
    for (const shoeMesh of standingShoes) shoeMesh.visible = seated === null;
    for (const shin of shins) {
      shin.visible = seated !== null;
      if (!seated) continue;
      const length = LEG.height * seated.shinShare;
      const [lowerLeg] = shin.children as THREE.Mesh[];
      lowerLeg.scale.y = seated.shinShare;
      lowerLeg.position.y = -length / 2;
      shin.position.z = -LEG.height * seated.thighShare;
    }
    for (const shoeMesh of sittingShoes)
      shoeMesh.position.y =
        -LEG.height * (seated?.shinShare ?? 1) + SHOE.height / 2;
    if (seated) legL.rotation.x = legR.rotation.x = seated.thigh;
    rig.position.y = seated?.drop ?? 0;
    label.sprite.position.y = NAME_TAG.center + (seated?.drop ?? 0);
  };
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
    setSeat,
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
          : new THREE.MeshStandardMaterial({
              color: skin,
              roughness: SURFACE_ROUGHNESS,
            }),
      );
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(
          VIDEO_FACE.size,
          VIDEO_FACE.size,
          VIDEO_FACE.depth,
        ),
        materials,
      );
      screen.position.y = HEAD_CENTER;
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

      if (faceMesh) faceMesh.visible = false;
      if (gearMesh) gearMesh.position.y = GEAR_LIFT_ON_SCREEN;
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
      if (seated) {
        armL.rotation.x = seated.arm;
        armR.rotation.x = seated.arm;
        rig.position.y = seated.drop;
      } else {
        phase += speed * dt * STRIDE_RADIANS_PER_METER;
        const pose = walkPose(phase, speed);
        legL.rotation.x = pose.legL;
        legR.rotation.x = pose.legR;
        armL.rotation.x = pose.armL;
        armR.rotation.x = pose.armR;
        rig.position.y = pose.bob;
      }

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
          if (object.material !== AVATAR_MATERIAL)
            (object.material as THREE.Material).dispose();
        } else if (object instanceof THREE.Sprite) {
          object.material.map?.dispose();
          object.material.dispose();
        }
      });
    },
  };
}
