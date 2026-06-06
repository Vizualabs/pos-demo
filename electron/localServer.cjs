const http = require("http")
const fs = require("fs")
const path = require("path")

const DEFAULT_PORT = 19500
const PROXY_PREFIXES = ["/api", "/files", "/uploads", "/images"]
const API_TARGET = (process.env.POS_API_TARGET || "http://34.29.70.169:8080").replace(/\/+$/, "")

let server = null
let serverUrl = ""

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const map = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".webp": "image/webp",
  }
  return map[ext] || "application/octet-stream"
}

function shouldProxy(urlPath) {
  return PROXY_PREFIXES.some((prefix) => urlPath === prefix || urlPath.startsWith(`${prefix}/`))
}

function proxyRequest(req, res, targetUrl) {
  const url = new URL(targetUrl)
  const headers = { ...req.headers, host: url.host }
  delete headers.connection

  const proxyReq = http.request(
    {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
      proxyRes.pipe(res)
    },
  )

  proxyReq.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" })
    }
    res.end(`API proxy error: ${err.message}`)
  })

  req.pipe(proxyReq)
}

function resolveStaticFile(distRoot, urlPath) {
  let requestPath = decodeURIComponent(String(urlPath || "/").split("?")[0])
  if (requestPath === "/" || requestPath === "") requestPath = "/index.html"

  const filePath = path.normalize(path.join(distRoot, requestPath))
  const rootNorm = path.normalize(distRoot + path.sep)
  if (!filePath.startsWith(rootNorm)) return null
  return filePath
}

function serveStatic(distRoot, req, res) {
  const filePath = resolveStaticFile(distRoot, req.url)
  if (!filePath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("Forbidden")
    return
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      const indexPath = path.join(distRoot, "index.html")
      fs.stat(indexPath, (indexErr, indexStat) => {
        if (indexErr || !indexStat.isFile()) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
          res.end("Not found")
          return
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        fs.createReadStream(indexPath).pipe(res)
      })
      return
    }

    res.writeHead(200, { "Content-Type": mimeType(filePath) })
    fs.createReadStream(filePath).pipe(res)
  })
}

function listenOnPort(distRoot, port) {
  return new Promise((resolve, reject) => {
    const httpServer = http.createServer((req, res) => {
      const urlPath = String(req.url || "/").split("?")[0]
      if (shouldProxy(urlPath)) {
        proxyRequest(req, res, `${API_TARGET}${req.url}`)
        return
      }
      serveStatic(distRoot, req, res)
    })

    httpServer.on("error", reject)
    httpServer.listen(port, "127.0.0.1", () => {
      server = httpServer
      serverUrl = `http://127.0.0.1:${port}/`
      resolve(serverUrl)
    })
  })
}

/** Same as electron:preview — bundled UI on localhost + API proxy. */
async function startBundledUiServer(distRoot) {
  if (serverUrl) return serverUrl

  const preferred = Number(process.env.POS_LOCAL_UI_PORT) || DEFAULT_PORT
  const ports = [preferred, preferred + 1, preferred + 2, preferred + 3]

  let lastError = null
  for (const port of ports) {
    try {
      return await listenOnPort(distRoot, port)
    } catch (err) {
      lastError = err
    }
  }

  throw lastError || new Error("Could not start bundled UI server")
}

function stopBundledUiServer() {
  if (!server) return
  server.close()
  server = null
  serverUrl = ""
}

module.exports = { startBundledUiServer, stopBundledUiServer, API_TARGET }
