import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ensureDevAuthSession } from "./config/devAuth";
import { syncPrintSettingsFromServer } from "./lib/serverPrint";

ensureDevAuthSession();
void syncPrintSettingsFromServer();

createRoot(document.getElementById("root")!).render(<App />);
