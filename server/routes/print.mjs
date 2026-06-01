import { Router } from "express"
import { runPrintJobsSequential } from "../services/printQueue.mjs"
import { loadPrintSettings, savePrintSettings } from "../store/printSettings.mjs"

export const printRouter = Router()

printRouter.get("/settings", async (_req, res) => {
  try {
    const settings = await loadPrintSettings()
    res.json(settings)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    res.status(500).json({ error: message })
  }
})

printRouter.put("/settings", async (req, res) => {
  try {
    const body = req.body ?? {}
    const settings = await savePrintSettings({
      customerPrinterIp: body.customerPrinterIp,
      kitchen1PrinterIp: body.kitchen1PrinterIp,
      kitchen2PrinterIp: body.kitchen2PrinterIp,
      printerPort: body.printerPort,
    })
    res.json(settings)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    res.status(500).json({ error: message })
  }
})

printRouter.post("/jobs", async (req, res) => {
  const { orderId, jobs } = req.body ?? {}

  if (!Array.isArray(jobs) || jobs.length === 0) {
    return res.status(400).json({ error: "jobs array required" })
  }

  for (const job of jobs) {
    if (typeof job.html !== "string" || !job.html.trim()) {
      return res.status(400).json({ error: "Each job needs html" })
    }
    const ip = String(job.printerIp ?? "").trim()
    if (!ip) {
      return res.status(400).json({ error: "Each job needs printerIp" })
    }
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
      return res.status(400).json({ error: `Invalid printer IP: ${ip}` })
    }
  }

  try {
    const result = await runPrintJobsSequential(jobs)
    const status = result.ok ? 200 : 207
    res.status(status).json({
      ok: result.ok,
      orderId: orderId ?? null,
      printed: result.printed,
      failed: result.failed,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    res.status(500).json({ error: message })
  }
})
