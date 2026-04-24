import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// When deployed separately (e.g. Vercel frontend + Railway backend),
// set VITE_API_URL to the Railway backend URL (e.g. https://your-app.up.railway.app)
const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(String(apiUrl));
}

createRoot(document.getElementById("root")!).render(<App />);
