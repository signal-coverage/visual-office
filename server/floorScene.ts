import { DEFAULT_SHELL } from "../shared/defaultShell.ts";
import type { LayoutMessage } from "../shared/floors.ts";
import { sceneFor, type FloorScene } from "../shared/layout.ts";
import { OFFICE_FURNITURE, OFFICE_MODELS } from "../shared/officeData.ts";
import type { LayoutStore } from "./layoutStore.ts";

/** What a game room is made from: the floor's scene and the stored version it came from. */
export interface LoadedScene {
  scene: FloorScene;
  /** The stored version, or null for the default that comes with the build. */
  version: number | null;
  /** Whether the floor has a shell of its own (the others have the default one). */
  ownShell: boolean;
}

/**
 * What stands in a floor, and the shell around it: what was last published, or
 * the default office that comes with the build when nothing was (or the
 * database cannot be reached, or the stored shell is not usable): a floor
 * always opens.
 */
export async function loadFloorScene(
  floor: string,
  layouts: Pick<LayoutStore, "current">,
): Promise<LoadedScene> {
  try {
    const stored = await layouts.current(floor);
    if (stored) {
      const scene = sceneFor(stored);
      const ownShell =
        stored.shell !== undefined && scene.shell !== DEFAULT_SHELL;
      if (stored.shell !== undefined && !ownShell)
        console.error(
          `The shell stored for the floor ${floor} is not usable, using the default one.`,
        );
      return { scene, version: stored.version, ownShell };
    }
  } catch (error) {
    console.error(
      "Could not load the floor's layout, using the default:",
      error,
    );
  }
  return {
    scene: sceneFor({ furniture: OFFICE_FURNITURE, models: OFFICE_MODELS }),
    version: null,
    ownShell: false,
  };
}

/** What each player who joins is told stands in the floor. The shell travels only when the floor has one of its own. */
export function layoutMessageOf({
  scene,
  version,
  ownShell,
}: LoadedScene): LayoutMessage {
  return {
    version,
    furniture: scene.furniture,
    models: scene.models,
    ...(ownShell ? { shell: scene.shell } : {}),
  };
}
