import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { devBackend } from "./backend";
import { EditorApp } from "./EditorApp";
import "../index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EditorApp backend={devBackend()} />
  </StrictMode>,
);
