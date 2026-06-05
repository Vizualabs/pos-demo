/**
 * Embeds build/icon.ico into the packaged app exe only.
 * Do NOT patch Setup.exe — that breaks NSIS integrity check.
 */
import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { rcedit } from "rcedit"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const branding = JSON.parse(readFileSync(join(root, "branding.json"), "utf8"))
const appName = branding.appName
const exePath = join(root, "release", "win-unpacked", `${appName}.exe`)
const icoPath = join(root, "build", "icon.ico")

if (!existsSync(icoPath)) {
  console.warn("embed-icon: build/icon.ico not found — skip")
  process.exit(0)
}
if (!existsSync(exePath)) {
  console.warn(`embed-icon: ${exePath} not found — skip`)
  process.exit(0)
}

await rcedit(exePath, { icon: icoPath })
console.log(`Icon embedded into: win-unpacked\\${appName}.exe`)
