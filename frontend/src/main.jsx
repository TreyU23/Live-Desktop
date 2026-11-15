// styles.css declares the cascade layer order (reset, legacy, astryx-base, astryx-theme), so it
// must be the first stylesheet in the bundle: import it before anything that pulls in Astryx CSS.
import "./styles.css";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
