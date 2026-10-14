import * as THREE from "three";
import { COLORS } from "../../shared/layout.ts";

const TILE_SIZE = 256;
const BOARDS = 8;
/** How many times the tile repeats over the whole floor (across, down). */
const REPEAT = [8, 6] as const;

const css = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/**
 * Wooden floorboards: light and dark strips with a thin seam in each, drawn on
 * a canvas so there is no image to load. Repeated over the floor.
 */
export function makeFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d")!;
  const height = TILE_SIZE / BOARDS;
  for (let i = 0; i < BOARDS; i++) {
    ctx.fillStyle = css(i % 2 ? COLORS.floor : COLORS.floorDark);
    ctx.fillRect(0, i * height, TILE_SIZE, height);
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.fillRect((i * 97) % 200, i * height, 2, height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...REPEAT);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
