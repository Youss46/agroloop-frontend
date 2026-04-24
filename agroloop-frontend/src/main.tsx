import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@/api-client";

// When deployed separately (e.g. Vercel frontend + Railway backend),
// set VITE_API_URL to the Railway backend URL (e.g. https://your-app.up.railway.app)
const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(String(apiUrl));
}

createRoot(document.getElementById("root")!).render(<App />);

// ── Service Worker (PWA) ──────────────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // Check for updates every hour
        setInterval(() => registration.update(), 60 * 60 * 1000);
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });
  });
}
