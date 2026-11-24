import "@fontsource/big-shoulders-display/700";
import "@fontsource/big-shoulders-display/800";
import "@fontsource/ibm-plex-sans-condensed/400";
import "@fontsource/ibm-plex-sans-condensed/600";
import "@fontsource/ibm-plex-mono/400";
import "@fontsource/ibm-plex-mono/600";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { config } from "./config.ts";
import "./styles/global.css";

void config;

const root = document.getElementById("root");
if (root === null) throw new Error("missing root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
