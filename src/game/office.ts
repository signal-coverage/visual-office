import * as THREE from "three";
import {
  OFFICE_DEPTH,
  OFFICE_HEIGHT,
  OFFICE_WIDTH,
} from "../../shared/constants.ts";
import { BOX_PIECES, COLORS, PLANTS } from "../../shared/layout.ts";

/** Draws the office described in shared/layout.ts. Collisions come from there too. */
export function buildOffice(): THREE.Group {
  const group = new THREE.Group();
  const materials = new Map<string, THREE.MeshStandardMaterial>();

  const material = (color: number, emissive = 0) => {
    const key = `${color}-${emissive}`;
    let cached = materials.get(key);
    if (!cached) {
      cached = new THREE.MeshStandardMaterial({
        color,
        emissive: emissive || 0x000000,
        emissiveIntensity: emissive ? 1 : 0,
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

  plane(0, 1, COLORS.floor);
  plane(OFFICE_HEIGHT, -1, COLORS.ceiling, COLORS.ceilingGlow);

  for (const piece of BOX_PIECES) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...piece.size),
      material(piece.color, piece.emissive),
    );
    mesh.position.set(...piece.at);
    mesh.castShadow = piece.shadows;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  for (const { x, z } of PLANTS) {
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
