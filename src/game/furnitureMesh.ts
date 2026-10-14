import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Furniture } from "../../shared/furniture.ts";
import { lookOf, type DetailLevel, type Part } from "./furnitureLook";

/**
 * Draws the furniture of a floor: every part of every piece is baked, where
 * it stands, into a few meshes. A desk, its keyboard and the other twenty-odd
 * pieces cost the same few draw calls as a single box, and nothing moves, so
 * nothing is computed per frame. Colours are vertex colours: one material
 * serves every paint.
 */

const SOLID_ROUGHNESS = 0.85;
const SCREEN_GLOW = 0x2a4f85;
const SCREEN_GLOW_STRENGTH = 0.7;

function geometryOf(part: Part): THREE.BufferGeometry {
  return part.shape === "box"
    ? new THREE.BoxGeometry(...part.size)
    : new THREE.CylinderGeometry(
        part.radiusTop,
        part.radiusBottom,
        part.height,
        part.segments,
        1,
      );
}

const scratch = {
  position: new THREE.Vector3(),
  rotation: new THREE.Euler(0, 0, 0, "YXZ"),
  quaternion: new THREE.Quaternion(),
  scale: new THREE.Vector3(1, 1, 1),
  part: new THREE.Matrix4(),
  item: new THREE.Matrix4(),
};

/** The part where it stands in the floor: the part's own place, then the turn and place of its piece. */
function bake(part: Part, item: Furniture): THREE.BufferGeometry {
  const geometry = geometryOf(part);
  geometry.deleteAttribute("uv");
  scratch.rotation.set(...(part.rot ?? [0, 0, 0]));
  scratch.quaternion.setFromEuler(scratch.rotation);
  scratch.part.compose(
    scratch.position.set(...part.at),
    scratch.quaternion,
    scratch.scale,
  );
  scratch.item
    .makeRotationY(THREE.MathUtils.degToRad(item.rotation))
    .setPosition(item.x, 0, item.z);
  geometry.applyMatrix4(scratch.item.multiply(scratch.part));

  const color = new THREE.Color(part.color);
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** The bucket a part is drawn in: what it is made of, and whether it casts a shadow. */
const bucketOf = (part: Part) =>
  part.surface === "solid" ? `solid-${part.shadow}` : part.surface;

/** The furniture of a floor as a few static meshes. Free it with the rest of the office. */
export function buildFurniture(
  items: readonly Furniture[],
  level: DetailLevel,
): THREE.Group {
  const buckets = new Map<string, THREE.BufferGeometry[]>();
  for (const item of items)
    for (const part of lookOf(item.kind, item.variant ?? 0, level)) {
      const key = bucketOf(part);
      const list = buckets.get(key) ?? [];
      list.push(bake(part, item));
      buckets.set(key, list);
    }

  const solid = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: SOLID_ROUGHNESS,
  });
  const materials: Record<string, THREE.Material> = {
    "solid-true": solid,
    "solid-false": solid,
    light: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1,
    }),
    screen: new THREE.MeshStandardMaterial({
      color: 0x10213a,
      emissive: SCREEN_GLOW,
      emissiveIntensity: SCREEN_GLOW_STRENGTH,
      roughness: 0.35,
    }),
  };

  const group = new THREE.Group();
  for (const [key, geometries] of buckets) {
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    const mesh = new THREE.Mesh(merged, materials[key]);
    mesh.castShadow = key === "solid-true";
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  return group;
}
