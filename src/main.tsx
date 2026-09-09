import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import en from "./locales/en.json";

if (import.meta.env.DEV) {
  const { isScreenshotMode, applyScreenshotLocaleOverrides, installScreenshotIpcMocks } = await import("./dev/screenshotMode");
  if (isScreenshotMode()) {
    applyScreenshotLocaleOverrides(en);
    installScreenshotIpcMocks();
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
