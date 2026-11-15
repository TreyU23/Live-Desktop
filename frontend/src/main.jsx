import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
// styles.css declares the cascade layer order, so it must load before Astryx's stylesheets.
import "./styles.css";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
