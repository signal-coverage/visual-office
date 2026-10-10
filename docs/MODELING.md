# Adding your own 3D models

You model an object (in Blender or anywhere that exports glTF), drop the file in the project,
add **one line**, and it appears in the office with collisions. There is a working example:
`public/models/bookshelf.glb`, placed in `shared/props.ts`.

## The 3-step version

1. Export your model as a `.glb` (settings below) and save it in `public/models/`.
2. Add a line to `PROPS` in [`shared/props.ts`](../shared/props.ts):

   ```ts
   { model: 'my-sofa.glb', at: [-3, 5.5], rotationDeg: 180, footprint: [2.1, 0.9] }
   ```

3. Reload the page. If you see a **magenta wireframe box** instead of your model, the file did not
   load: open the browser console, the warning says why (usually a wrong file name).

| Field         | Meaning                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `model`       | File name inside `public/models/`.                                                                                             |
| `at`          | `[x, z]` in meters, where the model's origin sits on the floor. The office goes from -10 to 10 in x and -7 to 7 in z.          |
| `rotationDeg` | Turn around the vertical axis. `0` leaves the model's front facing **+z** (towards the south wall).                            |
| `scale`       | Optional. Better to model at real size and leave this out.                                                                     |
| `footprint`   | `[width, depth]` in meters that players **cannot walk through**. Leave it out for things you can walk through (rugs, posters). |

The server uses `footprint` for collisions, not your model's shape, so players cannot cheat
through it and a messy mesh cannot trap anyone. Make it slightly smaller than the object so people
can brush against it.

## Modelling in Blender

**Set it up right from the start** (fixing it afterwards is the usual source of trouble):

- **Units**: Scene Properties → Units → Metric, scale `1.0`. Model at real size: a desk is about
  0.75 m high, a door 2.0 m. You can read the size in the `N` panel → Item → Dimensions.
- **Origin**: put the object's origin at the **center of its footprint, on the floor**. If the
  origin is in the middle of the object, it will float half its height above the floor.
- **Front**: face the front of the object towards **-Y** in Blender (the direction you look at in
  the numpad-1 front view). The exporter turns that into +z, which is what `rotationDeg: 0` expects.
- **Apply transforms**: select everything and press `Ctrl+A` → _All Transforms_. A scale of 1 and
  rotation of 0 avoids sizes that look right in Blender and wrong here.

**Keep it light.** The whole office is about 110 draw calls and 2.7k triangles today and runs at
100 fps on a good card; a weak laptop has far less headroom.

- Each _material_ in a model costs one draw call. Use few materials and join objects that share one
  (`Ctrl+J`). The sample bookshelf has 80+ boxes but only 10 draw calls for that reason.
- Aim for under ~5,000 triangles and ~10 materials per prop. Delete faces nobody sees.
- Textures: 1024×1024 or smaller, embedded in the `.glb`. Large images are what makes a download slow.

**Materials** use Blender's _Principled BSDF_: base color, roughness, metallic, emission and a normal
map are exported. Procedural shader nodes are not.

### Export settings

_File → Export → glTF 2.0_

| Section         | Setting                                                          |
| --------------- | ---------------------------------------------------------------- |
| Format          | **glTF Binary (.glb)**                                           |
| Include         | Selected Objects                                                 |
| Transform       | **+Y Up**                                                        |
| Mesh            | **Apply Modifiers**, Normals; UVs only if you use textures       |
| Material        | Export                                                           |
| **Compression** | **Off.** The game does not include the Draco or Meshopt decoders |
| Animation       | Off. Props are static for now                                    |

To see what you ended up with (triangles, materials, textures):

```bash
npx @gltf-transform/cli inspect public/models/my-sofa.glb
```

The same tool can shrink textures and remove unused data. Check `--help` for its `optimize`
command and keep compression disabled, for the reason above.

## Where to get models

- [Kenney](https://kenney.nl/assets) and [Quaternius](https://quaternius.com): large free packs,
  CC0 (no credit needed). Good style-consistent furniture.
- [Poly Pizza](https://poly.pizza): searchable low-poly models, a mix of CC0 and CC-BY.
- [Sketchfab](https://sketchfab.com): huge, but licenses vary and many models are too heavy.
  Filter by _Downloadable_ and download the glTF.
- AI "image to 3D" tools produce a mesh quickly, but expect to fix its scale, origin and polygon
  count in Blender before it behaves.

**Always check the license.** CC-BY requires crediting the author, and some licenses forbid use in
a product. Keep a note of where each model came from.

## Troubleshooting

| What you see                    | Likely cause                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------- |
| Magenta wireframe box           | The file did not load. Check the name in `PROPS` and the browser console.       |
| Floating or sunk into the floor | The origin is not at the floor. Fix it in Blender and re-export.                |
| Giant or tiny                   | The scene units were not metric, or transforms were not applied.                |
| Facing the wall                 | Turn it with `rotationDeg` (try `180`).                                         |
| Walk straight through it        | No `footprint`, or it is smaller than you think.                                |
| Cannot get past it              | The `footprint` is bigger than the object.                                      |
| Dark or black                   | The model has no normals, or its materials use shader nodes that do not export. |

## How it works (for the curious)

`shared/props.ts` is the single list. The client (`src/game/props.ts`) downloads each distinct
`.glb` once, clones it for every placement and draws it as it arrives, so the office is usable while
models load. The server never sees the model: `OFFICE_COLLIDERS` in `shared/layout.ts` adds each
prop's `footprint` next to the built-in furniture, and the movement referee uses the same boxes.

`node scripts/make-sample-props.mjs` regenerates the sample `bookshelf.glb` without any 3D software.
It is also the shortest example of what a well-formed model looks like.
