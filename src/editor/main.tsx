import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { sanitizeFloorId } from "../../shared/floors.ts";
import { devBackend } from "./backend";
import { EditorApp } from "./EditorApp";
import "../index.css";

/** `editor.html?floor=<room>` edits another room than the main office. */
const floor =
  sanitizeFloorId(new URLSearchParams(location.search).get("floor")) ??
  undefined;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EditorApp backend={devBackend(floor)} />
  </StrictMode>,
);
