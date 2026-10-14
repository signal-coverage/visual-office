import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Placed } from "./avatarLook";

const scratch = {
  position: new THREE.Vector3(),
  rotation: new THREE.Euler(0, 0, 0, "YXZ"),
  quaternion: new THREE.Quaternion(),
  scale: new THREE.Vector3(1, 1, 1),
  matrix: new THREE.Matrix4(),
};

/** One piece as a box in the frame of the part it moves with, painted with vertex colours. */
function bake(piece: Placed): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(...piece.size);
  geometry.deleteAttribute("uv");
  scratch.rotation.set(...(piece.rot ?? [0, 0, 0]));
  scratch.quaternion.setFromEuler(scratch.rotation);
  scratch.matrix.compose(
    scratch.position.set(...piece.at),
    scratch.quaternion,
    scratch.scale,
  );
  geometry.applyMatrix4(scratch.matrix);

  const color = new THREE.Color(piece.color);
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * The pieces that move together, merged into a single geometry: a whole arm
 * with its hand and watch costs one draw call, and one material (the one that
 * reads vertex colours) serves every colour of every person. Null when there
 * is nothing to draw.
 */
export function partGeometry(
  pieces: readonly Placed[],
): THREE.BufferGeometry | null {
  if (pieces.length === 0) return null;
  const geometries = pieces.map(bake);
  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  return merged;
}
