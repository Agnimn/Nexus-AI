import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

// Configure base URL for backend API requests (e.g. Render backend in production)
setBaseUrl(import.meta.env.VITE_API_URL || "");

// Attach the JWT from localStorage as Authorization: Bearer on every API call.
// This lets us authenticate cross-domain without relying on third-party cookies,
// which Chrome and Safari increasingly block in deployed cross-origin setups.
setAuthTokenGetter(() => localStorage.getItem("nexus_auth_token"));

createRoot(document.getElementById("root")!).render(<App />);
