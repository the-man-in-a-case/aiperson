import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import { OverlayApp } from "./overlay/OverlayApp.js";
import "./styles.css";

const pane = new URLSearchParams(location.search).get("pane");
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    {pane === "overlay" ? <OverlayApp /> : <App />}
  </React.StrictMode>,
);
