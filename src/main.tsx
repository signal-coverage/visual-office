import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LocatorSetup } from "./components/locator-setup";
import { AuthRoot } from "./components/AuthRoot";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocatorSetup />
    <AuthRoot />
  </StrictMode>,
);
