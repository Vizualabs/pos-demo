const { app, BrowserWindow, ipcMain, Menu } = require("electron")
const path = require("path")
const { printHtmlToPrinter, printJobsSequential, listSystemPrinters } = require("./print.cjs")
const { electronApiFetch } = require("./api.cjs")
const { loadBranding } = require("./branding.cjs")

const branding = loadBranding()

/** Set ELECTRON_DEV=true only when running `npm run electron:dev` (Vite on :5000). */
const useViteDevServer = process.env.ELECTRON_DEV === "true"
/** Hosted web UI — same build as browser; avoids file:// white-screen issues. */
const POS_WEB_URL = process.env.POS_WEB_URL || "http://34.29.70.169:5000"
let mainWindow = null

if (process.env.POS_DISABLE_GPU === "1") {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch("disable-gpu-sandbox")
}

function distIndexPath() {
  return path.join(app.getAppPath(), "dist", "index.html")
}

function createWindow() {
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

  if (useViteDevServer) {
    mainWindow.loadURL("http://localhost:5000")
    mainWindow.webContents.openDevTools({ mode: "detach" })
  } else if (process.env.POS_USE_BUNDLED === "1") {
    mainWindow.loadFile(distIndexPath()).catch((err) => {
      console.error("loadFile failed:", err)
    })
  } else {
    mainWindow.loadURL(POS_WEB_URL).catch((err) => {
      console.error("loadURL failed, trying bundled:", err)
      mainWindow.loadFile(distIndexPath()).catch((e) => console.error("loadFile failed:", e))
    })
  }

  mainWindow.webContents.on("did-fail-load", (_event, code, desc, url) => {
    console.error("Page failed to load:", code, desc, url)
    if (!useViteDevServer && url && String(url).startsWith(POS_WEB_URL)) {
      mainWindow.loadFile(distIndexPath()).catch((e) => console.error("fallback loadFile failed:", e))
    }
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
