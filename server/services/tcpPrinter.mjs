import net from "net"

const DEFAULT_TIMEOUT_MS = 15_000

/**
 * Send raw bytes to a network thermal printer (ESC/POS raw TCP, usually port 9100).
 * @param {string} host
 * @param {number} port
 * @param {Buffer} data
 */
export function sendToTcpPrinter(host, port, data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    let settled = false

    const finish = (err) => {
      if (settled) return
      settled = true
      socket.destroy()
      if (err) reject(err)
      else resolve()
    }

    socket.setTimeout(DEFAULT_TIMEOUT_MS)
    socket.on("timeout", () => finish(new Error(`Printer timeout: ${host}:${port}`)))
    socket.on("error", (err) => finish(err))
    socket.connect(port, host, () => {
      socket.write(data, (writeErr) => {
        if (writeErr) {
          finish(writeErr)
          return
        }
        // Allow the printer to receive the full raster before closing the socket.
        setTimeout(() => {
          socket.end(() => finish())
        }, 400)
      })
    })
  })
}
