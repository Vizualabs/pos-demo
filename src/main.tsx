import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { clearStaleDevAuthSession, ensureDevAuthSession } from "./config/devAuth";
import { syncPrintSettingsFromServer } from "./lib/serverPrint";

clearStaleDevAuthSession();
ensureDevAuthSession();
void syncPrintSettingsFromServer();

createRoot(document.getElementById("root")!).render(<App />);
