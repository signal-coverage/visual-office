import * as THREE from "three";
import type { Screen } from "../../shared/screens.ts";
import type { ScreenView } from "./CallController";
import { fitInside } from "./fit";

const BACKING = 0x0b0c10;
const TEXT = "#9aa0b4";
const PLACEHOLDER_SIZE = { width: 1280, height: 720 };
/** The picture sits this far in front of the black backing, so they never fight over the same depth. */
const LIFT = 0.002;

const MESSAGES = {
  none: ["No screen shared", "Press P to share yours"],
  offline: ["Join the call to see shared screens", "Press M, C or P"],
  local: ["You are sharing your screen", "Press P to stop"],
} as const;

/** A canvas with a couple of centred lines of text, as a picture to put on the screen. */
function placeholder(lines: readonly string[]): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = PLACEHOLDER_SIZE.width;
  canvas.height = PLACEHOLDER_SIZE.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0b0c10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 64px system-ui, sans-serif";
  ctx.fillText(lines[0], canvas.width / 2, canvas.height / 2 - 30);
  ctx.font = "40px system-ui, sans-serif";
  ctx.fillText(lines[1], canvas.width / 2, canvas.height / 2 + 40);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The screen on the wall. It shows what somebody in the room is sharing, kept
 * in proportion inside the frame, or a note saying that nothing is.
 */
export class ScreenDisplay {
  /** What to put in the scene. */
  readonly group = new THREE.Group();
  private readonly screen: Screen;
  private readonly content: THREE.Mesh;
  /** The notes shown when there is no picture to show, one per situation. */
  private readonly notes: Record<keyof typeof MESSAGES, THREE.CanvasTexture>;
  private video: { texture: THREE.VideoTexture; stop: () => void } | null =
    null;

  constructor(screen: Screen) {
    this.screen = screen;
    this.notes = {
      none: placeholder(MESSAGES.none),
      offline: placeholder(MESSAGES.offline),
      local: placeholder(MESSAGES.local),
    };

    const backing = new THREE.Mesh(
      new THREE.PlaneGeometry(screen.width, screen.height),
      new THREE.MeshBasicMaterial({ color: BACKING }),
    );
    this.content = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this.notes.none }),
    );
    this.content.position.z = LIFT;
    this.group.add(backing, this.content);

    this.group.position.set(screen.center.x, screen.center.y, screen.center.z);
    // A plane faces +z; turn it to face along the screen's normal
    this.group.rotation.y = Math.atan2(screen.normal.x, screen.normal.z);
    this.fit(PLACEHOLDER_SIZE.width / PLACEHOLDER_SIZE.height);
  }

  show(view: ScreenView): void {
    this.stopVideo();
    if (view.kind === "remote") {
      this.showVideo(view.element);
      return;
    }
    this.setPicture(this.notes[view.kind]);
    this.fit(PLACEHOLDER_SIZE.width / PLACEHOLDER_SIZE.height);
  }

  dispose(): void {
    this.stopVideo();
    for (const note of Object.values(this.notes)) note.dispose();
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
      }
    });
    this.group.removeFromParent();
  }

  private showVideo(element: HTMLVideoElement): void {
    // Always the way it comes: a shared screen must never be mirrored
    const texture = new THREE.VideoTexture(element);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.setPicture(texture);

    const fit = () =>
      this.fit(
        element.videoWidth && element.videoHeight
          ? element.videoWidth / element.videoHeight
          : 0,
      );
    fit();
    element.addEventListener("loadedmetadata", fit);
    element.addEventListener("resize", fit);
    void element.play().catch(() => {}); // it has no sound; ignore races
    this.video = {
      texture,
      stop: () => {
        element.removeEventListener("loadedmetadata", fit);
        element.removeEventListener("resize", fit);
      },
    };
  }

  private stopVideo(): void {
    if (!this.video) return;
    this.video.stop();
    this.video.texture.dispose();
    this.video = null;
  }

  private setPicture(map: THREE.Texture): void {
    const material = this.content.material as THREE.MeshBasicMaterial;
    material.map = map;
    material.needsUpdate = true;
  }

  /** Makes the picture as large as the frame allows without changing its shape. */
  private fit(aspect: number): void {
    const { width, height } = fitInside(
      aspect,
      this.screen.width,
      this.screen.height,
    );
    this.content.scale.set(width, height, 1);
  }
}
