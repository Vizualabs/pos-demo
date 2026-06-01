import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ensureDevAuthSession } from "./config/devAuth";
import { sanitizeAuthSession } from "./lib/authSession";
import { syncPrintSettingsFromServer } from "./lib/serverPrint";

sanitizeAuthSession();
ensureDevAuthSession();
void syncPrintSettingsFromServer();

createRoot(document.getElementById("root")!).render(<App />);
