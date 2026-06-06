const { BrowserWindow } = require("electron")

const PRINT_GAP_MS = 500
/** 80mm thermal roll (microns). */
const THERMAL_PAGE_WIDTH_MICRONS = 80000
const THERMAL_PAGE_HEIGHT_MICRONS = 297000
/** ~80mm at 96dpi — layout width matches thermal page for centered print block. */
const PRINT_WINDOW_WIDTH_PX = 302

function preparePrintHtml(html) {
  return String(html).replace(/<link[^>]+fonts\.googleapis\.com[^>]*>/gi, "")
}

async function waitForPrintLayout(win) {
  try {
    await win.webContents.executeJavaScript(
      `(async () => {
        void document.body?.offsetHeight
        if (document.fonts?.ready) {
          await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))])
        } else {
          await new Promise((r) => setTimeout(r, 350))
        }
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        void document.body?.offsetHeight
      })()`,
      true,
    )
  } catch {
    await new Promise((r) => setTimeout(r, 400))
  }
}

async function readContentHeight(win) {
  try {
    return await win.webContents.executeJavaScript(
      `Math.max(document.body?.scrollHeight ?? 0, document.documentElement?.scrollHeight ?? 0)`,
      true,
    )
  } catch {
    return 0
  }
}

/**
 * Silent print HTML to a named Windows printer (USB / LAN / shared queue).
 * Uses a hidden BrowserWindow so no dialog is shown.
 */
function printHtmlToPrinter(printerName, html) {
  const name = String(printerName ?? "").trim()
  if (!name) {
    return Promise.reject(new Error("printerName required"))
  }
  const doc = preparePrintHtml(String(html ?? ""))
  if (!doc.trim()) {
    return Promise.reject(new Error("html required"))
  }

  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      width: PRINT_WINDOW_WIDTH_PX,
      height: 1200,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    })

    let settled = false
    const finish = (err) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (!win.isDestroyed()) win.destroy()
      if (err) reject(err)
      else resolve()
    }

    const timeout = setTimeout(() => finish(new Error("Print timed out")), 60_000)

    win.webContents.on("did-fail-load", (_e, _code, desc) => {
      finish(new Error(desc || "Failed to load print document"))
    })

    win.webContents.on("did-finish-load", () => {
      void (async () => {
        await waitForPrintLayout(win)
        const contentHeight = await readContentHeight(win)
        if (contentHeight < 8) {
          finish(new Error("Print document has no content — check receipt HTML"))
          return
        }

        win.webContents.print(
          {
            silent: true,
            deviceName: name,
            printBackground: true,
            margins: { marginType: "none" },
            pageSize: {
              width: THERMAL_PAGE_WIDTH_MICRONS,
              height: THERMAL_PAGE_HEIGHT_MICRONS,
            },
          },
          (success, failureReason) => {
            if (success) finish()
            else finish(new Error(failureReason || "Print failed"))
          },
        )
      })().catch((e) => finish(e instanceof Error ? e : new Error(String(e))))
    })

    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(doc)}`
    win.loadURL(dataUrl).catch((e) => {
      finish(e instanceof Error ? e : new Error(String(e)))
    })
  })
}

/** Print jobs one after another (cashier bill, then kitchen tickets). */
async function printJobsSequential(jobs, gapMs = PRINT_GAP_MS) {
  const list = Array.isArray(jobs) ? jobs : []
  for (let i = 0; i < list.length; i++) {
    const job = list[i]
    await printHtmlToPrinter(job?.printerName, job?.html)
    if (i < list.length - 1 && gapMs > 0) {
      await new Promise((r) => setTimeout(r, gapMs))
    }
  }
}

/** List Windows printers visible to Chromium (same names as Control Panel). */
async function listSystemPrinters(mainWindow) {
  const wc = mainWindow?.webContents
  if (!wc || wc.isDestroyed()) return []
  if (typeof wc.getPrintersAsync === "function") {
    const printers = await wc.getPrintersAsync()
    return printers.map((p) => ({
      name: p.name,
      isDefault: Boolean(p.isDefault),
      status: p.status ?? 0,
    }))
  }
  const printers = wc.getPrinters?.() ?? []
  return printers.map((p) => ({
    name: p.name,
    isDefault: Boolean(p.isDefault),
    status: p.status ?? 0,
  }))
}

module.exports = { printHtmlToPrinter, printJobsSequential, listSystemPrinters, PRINT_GAP_MS }
