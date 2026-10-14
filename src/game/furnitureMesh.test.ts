import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  FURNITURE_KINDS,
  furnitureExtent,
  type Furniture,
  type Rotation,
} from "../../shared/furniture.ts";
import { DETAIL_LEVELS, lookOf, triangleCount } from "./furnitureLook";
import { buildFurniture } from "./furnitureMesh";

const meshesOf = (group: THREE.Group) =>
  group.children.filter(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh,
  );

const triangles = (group: THREE.Group) =>
  meshesOf(group).reduce(
    (sum, mesh) => sum + (mesh.geometry.index?.count ?? 0) / 3,
    0,
  );

const at = (
  kind: Furniture["kind"],
  x: number,
  z: number,
  rotation: Rotation = 0,
  variant = 0,
): Furniture => ({ kind, x, z, rotation, variant });

describe("buildFurniture", () => {
  it("draws exactly the triangles of the look, however it merges them", () => {
    for (const kind of FURNITURE_KINDS)
      for (const level of DETAIL_LEVELS) {
        const group = buildFurniture([at(kind, 1, 2, 90)], level);
        expect(triangles(group), `${kind} ${level}`).toBe(
          triangleCount(lookOf(kind, 0, level)),
        );
      }
  });

  it("makes a few meshes for the whole office, not one for every piece", () => {
    const items: Furniture[] = [];
    for (let i = 0; i < 12; i++) {
      items.push(
        at("desk", i * 3, 0),
        at("chair", i * 3, 1),
        at("plant", i, 5),
      );
    }
    const group = buildFurniture(items, "high");
    expect(meshesOf(group).length).toBeLessThanOrEqual(4);
    const materials = new Set(meshesOf(group).map((m) => m.material));
    expect(materials.size).toBeLessThanOrEqual(4);
  });

  it("casts shadows only from the big parts and receives them everywhere", () => {
    const group = buildFurniture([at("desk", 0, 0), at("rug", 5, 5)], "high");
    const meshes = meshesOf(group);
    expect(meshes.some((m) => m.castShadow)).toBe(true);
    expect(meshes.some((m) => !m.castShadow)).toBe(true);
    expect(meshes.every((m) => m.receiveShadow)).toBe(true);
  });

  it("does not move after it is built", () => {
    for (const mesh of meshesOf(buildFurniture([at("desk", 0, 0)], "high")))
      expect(mesh.matrixAutoUpdate).toBe(false);
  });

  it("is drawn where the piece stands, turned as it is turned", () => {
    for (const rotation of [0, 90, 180, 270] as Rotation[]) {
      const item = at("desk", 4, -3, rotation);
      const box = new THREE.Box3();
      for (const mesh of meshesOf(buildFurniture([item], "high"))) {
        mesh.geometry.computeBoundingBox();
        box.union(mesh.geometry.boundingBox!);
      }
      const area = furnitureExtent(item).reduce((acc, b) => ({
        minX: Math.min(acc.minX, b.minX),
        maxX: Math.max(acc.maxX, b.maxX),
        minZ: Math.min(acc.minZ, b.minZ),
        maxZ: Math.max(acc.maxZ, b.maxZ),
      }));
      expect(box.min.x).toBeGreaterThanOrEqual(area.minX - 0.06);
      expect(box.max.x).toBeLessThanOrEqual(area.maxX + 0.06);
      expect(box.min.z).toBeGreaterThanOrEqual(area.minZ - 0.06);
      expect(box.max.z).toBeLessThanOrEqual(area.maxZ + 0.06);
      expect(box.max.x - box.min.x).toBeGreaterThan(
        (area.maxX - area.minX) * 0.9,
      );
    }
  });

  it("paints with vertex colours so one material serves every colour", () => {
    const [solid] = meshesOf(buildFurniture([at("desk", 0, 0)], "high"));
    expect(solid.geometry.getAttribute("color")).toBeDefined();
    expect((solid.material as THREE.MeshStandardMaterial).vertexColors).toBe(
      true,
    );
  });

  it("builds nothing for no furniture", () => {
    expect(buildFurniture([], "high").children).toHaveLength(0);
  });
});
