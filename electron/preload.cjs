const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  printHtml: (printerName, html) =>
    ipcRenderer.invoke("print:html", { printerName, html }),
  printSequential: (jobs, gapMs) =>
    ipcRenderer.invoke("print:sequential", { jobs, gapMs }),
  listPrinters: () => ipcRenderer.invoke("print:list-printers"),
  getVersion: () => ipcRenderer.invoke("app:version"),
  fetch: (url, init) => ipcRenderer.invoke("api:fetch", { url, init }),
})
