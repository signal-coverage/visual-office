import * as THREE from "three";
import {
  OFFICE_DEPTH,
  OFFICE_HEIGHT,
  OFFICE_WIDTH,
} from "../../shared/constants.ts";
import {
  BOX_PIECES,
  COLORS,
  PLANTS,
  type FloorScene,
} from "../../shared/layout.ts";
import { makeFloorTexture } from "./floorTexture";

/** What is drawn by default: the layout every build carries. */
const DEFAULT_DRAWING = { pieces: BOX_PIECES, plants: PLANTS };

/** Draws the office described in shared/layout.ts. Collisions come from there too. */
export function buildOffice({
  pieces,
  plants,
}: Pick<FloorScene, "pieces" | "plants"> = DEFAULT_DRAWING): THREE.Group {
  const group = new THREE.Group();
  const materials = new Map<string, THREE.MeshStandardMaterial>();

  const material = (color: number, emissive = 0, opacity = 1) => {
    const key = `${color}-${emissive}-${opacity}`;
    let cached = materials.get(key);
    if (!cached) {
      cached = new THREE.MeshStandardMaterial({
        color,
        emissive: emissive || 0x000000,
        emissiveIntensity: emissive ? 1 : 0,
        transparent: opacity < 1,
        opacity,
      });
      materials.set(key, cached);
    }
    return cached;
  };

  const plane = (y: number, facing: 1 | -1, color: number, emissive = 0) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(OFFICE_WIDTH, OFFICE_DEPTH),
      material(color, emissive),
    );
    mesh.rotation.x = (-Math.PI / 2) * facing;
    mesh.position.y = y;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(OFFICE_WIDTH, OFFICE_DEPTH),
    new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.8 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  plane(OFFICE_HEIGHT, -1, COLORS.ceiling, COLORS.ceilingGlow);

  for (const piece of pieces) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...piece.size),
      material(piece.color, piece.emissive, piece.opacity),
    );
    mesh.position.set(...piece.at);
    mesh.castShadow = piece.shadows;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  for (const { x, z } of plants) {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.16, 0.4, 12),
      material(COLORS.pot),
    );
    pot.position.set(x, 0.2, z);
    pot.castShadow = true;
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 12, 10),
      material(COLORS.leaves),
    );
    leaves.position.set(x, 0.75, z);
    leaves.castShadow = true;
    group.add(pot, leaves);
  }

  return group;
}

/** Frees what an office drew, for when it is replaced by another. */
export function disposeOffice(office: THREE.Group): void {
  const materials = new Set<THREE.Material>();
  office.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      materials.add(material);
  });
  for (const material of materials) {
    if (material instanceof THREE.MeshStandardMaterial) material.map?.dispose();
    material.dispose();
  }
}
