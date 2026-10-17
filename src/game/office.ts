import * as THREE from "three";
import { OFFICE_HEIGHT } from "../../shared/constants.ts";
import { COLORS, sceneFor, type FloorScene } from "../../shared/layout.ts";
import { OFFICE_FURNITURE } from "../../shared/officeData.ts";
import { makeFloorTexture } from "./floorTexture";
import type { DetailLevel } from "./furnitureLook";
import { buildFurniture } from "./furnitureMesh";

/** What is drawn by default: the layout every build carries. */
const DEFAULT_DRAWING = sceneFor({ furniture: OFFICE_FURNITURE, models: [] });

/**
 * Draws the office described in shared/layout.ts: the shell box by box and the
 * furniture merged into a few meshes (furnitureMesh.ts). Collisions come from
 * the layout too, and do not depend on how a piece is drawn.
 */
export function buildOffice(
  {
    shell,
    shellPieces,
    furniture,
  }: Pick<FloorScene, "shell" | "shellPieces" | "furniture"> = DEFAULT_DRAWING,
  detail: DetailLevel = "high",
): THREE.Group {
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
      new THREE.PlaneGeometry(shell.width, shell.depth),
      material(color, emissive),
    );
    mesh.rotation.x = (-Math.PI / 2) * facing;
    mesh.position.y = y;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(shell.width, shell.depth),
    new THREE.MeshStandardMaterial({
      map: makeFloorTexture(shell.width, shell.depth),
      roughness: 0.8,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  plane(shell.height ?? OFFICE_HEIGHT, -1, COLORS.ceiling, COLORS.ceilingGlow);

  for (const piece of shellPieces) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...piece.size),
      material(piece.color, piece.emissive, piece.opacity),
    );
    mesh.position.set(...piece.at);
    mesh.castShadow = piece.shadows;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  group.add(buildFurniture(furniture, detail));

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
