import "@/themes/store";
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { preloadSetGenerator } from "@/core/spire/teams";

// Competitive sets for late-game echoes load in the background.
void preloadSetGenerator();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
