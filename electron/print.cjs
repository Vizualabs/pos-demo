const { BrowserWindow } = require("electron")

const PRINT_GAP_MS = 500

/**
 * Silent print HTML to a named Windows printer (USB / LAN / shared queue).
 * Uses a hidden BrowserWindow so no dialog is shown.
 */
function printHtmlToPrinter(printerName, html) {
  const name = String(printerName ?? "").trim()
  if (!name) {
    return Promise.reject(new Error("printerName required"))
  }
  const doc = String(html ?? "")
  if (!doc.trim()) {
    return Promise.reject(new Error("html required"))
  }

  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      width: 400,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    })

    let settled = false
    const finish = (err) => {
      if (settled) return
      settled = true
      win.destroy()
      if (err) reject(err)
      else resolve()
    }

    const timeout = setTimeout(() => finish(new Error("Print timed out")), 60_000)

    win.webContents.on("did-fail-load", (_e, _code, desc) => {
      clearTimeout(timeout)
      finish(new Error(desc || "Failed to load print document"))
    })

    win.webContents.on("did-finish-load", () => {
      win.webContents.print(
        {
          silent: true,
          deviceName: name,
          printBackground: true,
          margins: { marginType: "none" },
        },
        (success, failureReason) => {
          clearTimeout(timeout)
          if (success) finish()
          else finish(new Error(failureReason || "Print failed"))
        },
      )
    })

    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(doc)}`
    win.loadURL(dataUrl).catch((e) => {
      clearTimeout(timeout)
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
