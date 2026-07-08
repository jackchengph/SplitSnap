import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./App.css";

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
} else if ("serviceWorker" in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(registrations.map((registration) => registration.unregister()))
    )
    .then(() => caches.keys())
    .then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
