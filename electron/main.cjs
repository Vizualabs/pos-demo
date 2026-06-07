const { app, BrowserWindow, ipcMain, Menu } = require("electron")
const path = require("path")
const { printHtmlToPrinter, printJobsSequential, listSystemPrinters } = require("./print.cjs")
const { electronApiFetch } = require("./api.cjs")
const { loadBranding } = require("./branding.cjs")
const { startBundledUiServer, stopBundledUiServer } = require("./localServer.cjs")

const branding = loadBranding()

/** Set ELECTRON_DEV=true only when running `npm run electron:dev` (Vite on :5000). */
const useViteDevServer = process.env.ELECTRON_DEV === "true"
/** Local preview: vite preview URL (http — avoids file:// white screen). */
const previewWebUrl = process.env.ELECTRON_PREVIEW?.trim() || ""
/** Optional remote UI — off by default; packaged app uses bundled UI like electron:preview. */
const POS_WEB_URL = process.env.POS_WEB_URL || "http://35.223.93.6:5000"
const useRemoteWebUi = process.env.POS_USE_REMOTE_UI === "1"
let mainWindow = null

if (process.env.POS_DISABLE_GPU === "1") {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch("disable-gpu-sandbox")
}

async function resolveAppLoadUrl() {
  if (useViteDevServer) return "http://localhost:5000"
  if (previewWebUrl) return previewWebUrl

  const distRoot = path.join(app.getAppPath(), "dist")
  const useBundledUi = app.isPackaged || process.env.POS_USE_BUNDLED === "1"

  if (useBundledUi || !useRemoteWebUi) {
    return startBundledUiServer(distRoot)
  }

  return POS_WEB_URL
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: branding.windowTitle || branding.appName || "DineMate POS",
    show: false,
    backgroundColor: "#fcfbfa",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  })

  mainWindow.once("ready-to-show", () => {
    mainWindow.show()
  })

  try {
    const loadUrl = await resolveAppLoadUrl()
    await mainWindow.loadURL(loadUrl)
    if (useViteDevServer) {
      mainWindow.webContents.openDevTools({ mode: "detach" })
    }
  } catch (err) {
    console.error("App load failed:", err)
    const indexPath = path.join(app.getAppPath(), "dist", "index.html")
    try {
      await mainWindow.loadFile(indexPath)
    } catch (fallbackErr) {
      console.error("Fallback loadFile failed:", fallbackErr)
      mainWindow.show()
    }
  }

  mainWindow.webContents.on("did-fail-load", (_event, code, desc, url) => {
    console.error("Page failed to load:", code, desc, url)
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("will-quit", () => {
  stopBundledUiServer()
})

ipcMain.handle("print:html", async (_event, { printerName, html }) => {
  await printHtmlToPrinter(printerName, html)
  return { ok: true }
})

ipcMain.handle("print:sequential", async (_event, { jobs, gapMs }) => {
  await printJobsSequential(jobs, gapMs)
  return { ok: true }
})

ipcMain.handle("print:list-printers", async () => {
  return listSystemPrinters(mainWindow)
})

ipcMain.handle("app:version", () => app.getVersion())

ipcMain.handle("api:fetch", async (_event, { url, init }) => {
  return electronApiFetch(url, init ?? {})
})
