const path = require("path")
const fs = require("fs")

function loadBranding() {
  const candidates = [
    path.join(__dirname, "..", "branding.json"),
    path.join(process.cwd(), "branding.json"),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf8"))
      }
    } catch {
      /* try next */
    }
  }
  return {
    appName: "DineMate POS",
    windowTitle: "DineMate POS",
  }
}

module.exports = { loadBranding }
