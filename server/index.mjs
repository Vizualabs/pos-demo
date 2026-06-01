/**
 * Cloud POS print server — silent network thermal printing (no client PC install).
 * POST /api/print/jobs  { orderId, jobs: [{ slot, html, printerIp, port? }] }
 * GET/PUT /api/print/settings
 */
import cors from "cors"
import express from "express"
import { printRouter } from "./routes/print.mjs"
import { closePrintBrowser } from "./services/htmlToPrint.mjs"

const PORT = Number(process.env.PORT) || 3001

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: "8mb" }))

/** Auth stub — wire to session/JWT when POS auth is unified on Node. */
app.use("/api/print", (_req, _res, next) => {
  next()
})

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "pos-print-server" })
})

app.use("/api/print", printRouter)

app.use((err, _req, res, _next) => {
  const message = err instanceof Error ? err.message : String(err)
  res.status(500).json({ error: message })
})

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`POS print server: http://127.0.0.1:${PORT}`)
  console.log(`  POST /api/print/jobs`)
  console.log(`  GET/PUT /api/print/settings`)
})

server.on("error", (err) => {
  if (err && typeof err === "object" && "code" in err && err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the other print server or run: PORT=3002 npm run dev --prefix server`,
    )
    process.exit(1)
  }
  throw err
})

async function shutdown() {
  server.close()
  await closePrintBrowser()
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
