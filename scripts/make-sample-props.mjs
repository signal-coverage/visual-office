// Generates public/models/bookshelf.glb, a sample prop for the office.
//
//   node scripts/make-sample-props.mjs
//
// It exists to show what a good model looks like and to prove the pipeline end
// to end. Your own models would come from Blender (see docs/MODELING.md); this
// file just builds one from boxes so it needs no 3D software.
//
// Conventions a model must follow (the same as a Blender export gives you):
//   - meters, +Y up
//   - origin at the center of the footprint, on the floor
//   - front of the model facing +Z
//   - few meshes: boxes are merged per material, so the whole shelf is 10 draw calls
//     (80+ separate boxes would be 80+)
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Document, NodeIO } from "@gltf-transform/core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "public", "models", "bookshelf.glb");

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene("bookshelf");

const hex = (value) => [
  ((value >> 16) & 255) / 255,
  ((value >> 8) & 255) / 255,
  (value & 255) / 255,
  1,
];
const materials = new Map();
const material = (color, roughness = 0.75) => {
  if (!materials.has(color)) {
    const m = doc
      .createMaterial(`#${color.toString(16).padStart(6, "0")}`)
      .setBaseColorFactor(hex(color))
      .setRoughnessFactor(roughness)
      .setMetallicFactor(0);
    // Primitive data gathered per material and written as one mesh at the end
    materials.set(color, {
      material: m,
      positions: [],
      normals: [],
      indices: [],
    });
  }
  return materials.get(color);
};

// Corners are listed counter-clockwise as seen from outside, so faces point outward
const FACES = (hw, hh, hd) => [
  {
    n: [0, 0, 1],
    v: [
      [-hw, -hh, hd],
      [hw, -hh, hd],
      [hw, hh, hd],
      [-hw, hh, hd],
    ],
  },
  {
    n: [0, 0, -1],
    v: [
      [hw, -hh, -hd],
      [-hw, -hh, -hd],
      [-hw, hh, -hd],
      [hw, hh, -hd],
    ],
  },
  {
    n: [1, 0, 0],
    v: [
      [hw, -hh, hd],
      [hw, -hh, -hd],
      [hw, hh, -hd],
      [hw, hh, hd],
    ],
  },
  {
    n: [-1, 0, 0],
    v: [
      [-hw, -hh, -hd],
      [-hw, -hh, hd],
      [-hw, hh, hd],
      [-hw, hh, -hd],
    ],
  },
  {
    n: [0, 1, 0],
    v: [
      [-hw, hh, hd],
      [hw, hh, hd],
      [hw, hh, -hd],
      [-hw, hh, -hd],
    ],
  },
  {
    n: [0, -1, 0],
    v: [
      [-hw, -hh, -hd],
      [hw, -hh, -hd],
      [hw, -hh, hd],
      [-hw, -hh, hd],
    ],
  },
];

/** Adds a box of size [w, h, d] centered at [x, y, z]. */
const box = ([w, h, d], [x, y, z], color) => {
  const target = material(color);
  for (const { n, v } of FACES(w / 2, h / 2, d / 2)) {
    const base = target.positions.length / 3;
    for (const [px, py, pz] of v) {
      target.positions.push(px + x, py + y, pz + z);
      target.normals.push(...n);
    }
    target.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
};

// --- The shelf (meters) ---------------------------------------------------
const WIDTH = 1.6;
const HEIGHT = 1.9;
const DEPTH = 0.38;
const PANEL = 0.04;
const WOOD = 0x8d6a45;
const BACK = 0x6d5236;
const BOOK_COLORS = [
  0xc0392b, 0x2e86c1, 0x27ae60, 0xf1c40f, 0x8e44ad, 0xe67e22, 0x16a085,
  0xecf0f1,
];

box([PANEL, HEIGHT, DEPTH], [-(WIDTH - PANEL) / 2, HEIGHT / 2, 0], WOOD); // left side
box([PANEL, HEIGHT, DEPTH], [(WIDTH - PANEL) / 2, HEIGHT / 2, 0], WOOD); // right side
box([WIDTH, PANEL, DEPTH], [0, HEIGHT - PANEL / 2, 0], WOOD); // top
box([WIDTH - 2 * PANEL, 0.08, DEPTH], [0, 0.04, 0], WOOD); // base
box(
  [WIDTH - 2 * PANEL, HEIGHT - 0.1, 0.02],
  [0, HEIGHT / 2, -DEPTH / 2 + 0.01],
  BACK,
); // back, at -z

const shelfHeights = [0.42, 0.8, 1.18, 1.56];
for (const y of shelfHeights)
  box([WIDTH - 2 * PANEL, 0.03, DEPTH - 0.02], [0, y, 0.01], WOOD);

// Books: a repeatable "random" so the file is identical every time it is generated
let seed = 7;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const bottoms = [0.08, ...shelfHeights.map((y) => y + 0.015)];
for (const bottom of bottoms) {
  let x = -(WIDTH - 2 * PANEL) / 2 + 0.04;
  const limit = (WIDTH - 2 * PANEL) / 2 - 0.04;
  while (x < limit - 0.08) {
    const bookWidth = 0.03 + random() * 0.04;
    const bookHeight = 0.2 + random() * 0.12;
    if (random() > 0.18) {
      box(
        [bookWidth, bookHeight, DEPTH - 0.1],
        [x + bookWidth / 2, bottom + bookHeight / 2, 0.02],
        BOOK_COLORS[Math.floor(random() * BOOK_COLORS.length)],
      );
    }
    x += bookWidth + 0.003;
    if (random() > 0.9) x += 0.12; // an empty gap now and then
  }
}

// --- Write one mesh per material ------------------------------------------
const accessor = (type, array) =>
  doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);

const mesh = doc.createMesh("bookshelf");
for (const { material: m, positions, normals, indices } of materials.values()) {
  mesh.addPrimitive(
    doc
      .createPrimitive()
      .setAttribute("POSITION", accessor("VEC3", new Float32Array(positions)))
      .setAttribute("NORMAL", accessor("VEC3", new Float32Array(normals)))
      .setIndices(accessor("SCALAR", new Uint16Array(indices)))
      .setMaterial(m),
  );
}
scene.addChild(doc.createNode("bookshelf").setMesh(mesh));

mkdirSync(dirname(output), { recursive: true });
await new NodeIO().write(output, doc);
console.log(
  `Wrote ${output}: ${materials.size} materials, ${materials.size} draw calls`,
);
