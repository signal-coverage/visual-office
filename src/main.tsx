import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LocatorSetup } from "./components/locator-setup";
import { App } from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocatorSetup />
    <App />
  </StrictMode>,
);
