import * as THREE from "three";
import { PROPS, type PropPlacement } from "../../shared/props.ts";

export interface LoadedProps {
  group: THREE.Group;
  dispose: () => void;
}

const MISSING_MODEL_COLOR = 0xff00ff;
const PLACEHOLDER_HEIGHT = 0.8;

function disposeAll(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) value.dispose();
      material.dispose();
    }
  });
}

/** Stands in for a model that failed to load, at the size of its footprint, so the problem is visible. */
function placeholder(prop: PropPlacement): THREE.Object3D {
  const [width, depth] = prop.footprint ?? [0.5, 0.5];
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, PLACEHOLDER_HEIGHT, depth),
    new THREE.MeshStandardMaterial({
      color: MISSING_MODEL_COLOR,
      wireframe: true,
    }),
  );
  mesh.position.y = PLACEHOLDER_HEIGHT / 2;
  const holder = new THREE.Group();
  holder.add(mesh);
  return holder;
}

function place(object: THREE.Object3D, prop: PropPlacement) {
  const [x, z] = prop.at;
  object.position.set(x, 0, z);
  object.rotation.y = THREE.MathUtils.degToRad(prop.rotationDeg ?? 0);
  object.scale.setScalar(prop.scale ?? 1);
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

/**
 * Loads the models listed in shared/props.ts and adds them to the returned
 * group as they arrive, so the office is usable while they download.
 * A model that cannot be loaded is drawn as a magenta wireframe box instead.
 */
export function loadProps(placements: PropPlacement[] = PROPS): LoadedProps {
  const group = new THREE.Group();
  let disposed = false;

  if (placements.length > 0) {
    void (async () => {
      // Only downloaded when there is something to load
      const { GLTFLoader } =
        await import("three/examples/jsm/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const models = new Map<string, Promise<THREE.Object3D | null>>();
      const load = (file: string) => {
        let pending = models.get(file);
        if (!pending) {
          pending = loader
            .loadAsync(`${import.meta.env.BASE_URL}models/${file}`)
            .then((gltf) => gltf.scene)
            .catch((error) => {
              console.warn(`Could not load the model "${file}"`, error);
              return null;
            });
          models.set(file, pending);
        }
        return pending;
      };

      for (const prop of placements) {
        const source = await load(prop.model);
        if (disposed) return;
        const object = source ? source.clone(true) : placeholder(prop);
        place(object, prop);
        group.add(object);
      }
    })();
  }

  return {
    group,
    dispose() {
      disposed = true;
      disposeAll(group);
    },
  };
}
