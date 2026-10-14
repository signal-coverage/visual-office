import { lazy, Suspense, useState } from "react";
import { FLOOR_ID } from "../../../shared/floors.ts";
import { gameBackend } from "../../editor/backend";
import { currentServerUrl } from "../../game/serverAddress";
import * as styles from "./styles";
import type { GameEditorProps } from "./types";

// Its own chunk: only the people who may edit ever download it
const EditorApp = lazy(() =>
  import("../../editor/EditorApp").then((module) => ({
    default: module.EditorApp,
  })),
);

/**
 * The office editor inside the game, for the heads of a floor and the admins.
 * It talks to the game server itself, as the person who signed in; the server
 * checks their role on every call, whatever this page says.
 */
export function GameEditor({ getToken, onClose }: GameEditorProps) {
  const [backend] = useState(() =>
    gameBackend({
      serverUrl: currentServerUrl(),
      floor: FLOOR_ID,
      getToken,
      models: __MODEL_FILES__,
    }),
  );

  return (
    <div style={styles.overlay}>
      <Suspense
        fallback={<div style={styles.loading}>Loading the editor…</div>}
      >
        <EditorApp backend={backend} onClose={onClose} />
      </Suspense>
    </div>
  );
}
