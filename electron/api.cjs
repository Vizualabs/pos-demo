/** Server API calls from main process (no CORS restrictions). */
async function electronApiFetch(url, init = {}) {
  const method = init.method ?? "GET"
  const headers = init.headers ?? {}
  const body = init.body

  const res = await fetch(url, { method, headers, body })
  const resHeaders = {}
  res.headers.forEach((value, key) => {
    resHeaders[key] = value
  })

  const contentType = String(res.headers.get("content-type") ?? "").toLowerCase()
  const isText =
    contentType.includes("json") ||
    contentType.includes("text/") ||
    contentType.includes("javascript") ||
    contentType.includes("xml")

  if (isText) {
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
      body: await res.text(),
      encoding: "text",
    }
  }

  const buf = Buffer.from(await res.arrayBuffer())
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    headers: resHeaders,
    body: buf.toString("base64"),
    encoding: "base64",
  }
}

module.exports = { electronApiFetch }
