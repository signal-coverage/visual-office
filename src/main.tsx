import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LocatorSetup } from "./components/locator-setup";
import { AuthRoot } from "./components/AuthRoot";
import { startErrorMonitoring } from "./monitoring";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocatorSetup />
    <AuthRoot />
  </StrictMode>,
);

startErrorMonitoring();
