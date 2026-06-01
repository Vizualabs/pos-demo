import { htmlToEscPosBuffer } from "./htmlToPrint.mjs"
import { sendToTcpPrinter } from "./tcpPrinter.mjs"

const JOB_GAP_MS = Number(process.env.PRINT_JOB_GAP_MS) || 1500

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * @typedef {{ slot: string, html: string, printerIp: string, port?: number }} PrintJobInput
 */

/**
 * Process print jobs sequentially: kitchen tickets first, then bill (order from caller).
 * @param {PrintJobInput[]} jobs
 */
export async function runPrintJobsSequential(jobs) {
  /** @type {string[]} */
  const printed = []
  /** @type {{ slot: string, error: string }[]} */
  const failed = []

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]
    const ip = String(job.printerIp ?? "").trim()
    const port = Number(job.port) || 9100
    const slot = String(job.slot ?? `job-${i}`)

    if (!ip) {
      failed.push({ slot, error: "printerIp required" })
      continue
    }
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
      failed.push({ slot, error: `Invalid printer IP: ${ip}` })
      continue
    }
    if (typeof job.html !== "string" || !job.html.trim()) {
      failed.push({ slot, error: "html required" })
      continue
    }

    try {
      const bytes = await htmlToEscPosBuffer(job.html)
      await sendToTcpPrinter(ip, port, bytes)
      printed.push(slot)
      console.log(`[print] OK ${slot} → ${ip}:${port} (${bytes.length} bytes)`)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      failed.push({ slot, error: message })
      console.error(`[print] FAIL ${slot} → ${ip}:${port}: ${message}`)
    }

    if (i < jobs.length - 1) {
      await sleep(JOB_GAP_MS)
    }
  }

  return { printed, failed, ok: failed.length === 0 }
}
