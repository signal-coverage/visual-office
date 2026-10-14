/** How much smaller than the object people can still touch it: the docs say a little smaller. */
const SHRINK = 0.95;
const GRID = 0.05;
const MINIMUM = 0.1;

/**
 * The floor box to block for an object of this size (meters): a little smaller
 * than the object, on the 5 cm grid, and rounded down so it is never bigger.
 */
export function footprintFromSize(
  width: number,
  depth: number,
): [number, number] {
  const side = (size: number) => {
    if (!Number.isFinite(size)) return MINIMUM;
    // The tiny addition stops 1.6 / 0.05 = 31.999999 from rounding down a whole step
    const cells = Math.floor((size * SHRINK) / GRID + 1e-9);
    return Math.max(MINIMUM, Math.round(cells * GRID * 1e6) / 1e6);
  };
  return [side(width), side(depth)];
}

const cache = new Map<string, Promise<[number, number] | null>>();

/** Forgets a measurement, e.g. because the file was replaced by another. */
export function forgetModel(name: string): void {
  cache.delete(name);
}

/**
 * How big a model is on the floor, by loading it and measuring it, so placing
 * one starts with a sensible footprint. Null when it cannot be loaded.
 */
export function measureModel(name: string): Promise<[number, number] | null> {
  let measured = cache.get(name);
  if (!measured) {
    measured = (async () => {
      try {
        const [{ GLTFLoader }, { Box3, Vector3 }] = await Promise.all([
          import("three/examples/jsm/loaders/GLTFLoader.js"),
          import("three"),
        ]);
        const gltf = await new GLTFLoader().loadAsync(
          `/models/${encodeURIComponent(name)}`,
        );
        const size = new Box3()
          .setFromObject(gltf.scene)
          .getSize(new Vector3());
        return footprintFromSize(size.x, size.z);
      } catch (error) {
        console.warn(`Could not measure ${name}`, error);
        return null;
      }
    })();
    cache.set(name, measured);
  }
  return measured;
}
