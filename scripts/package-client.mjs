/**
 * After electron-builder, bundle client deliverables:
 * - Primary: DineMate POS Setup X.X.X.exe (NSIS installer)
 * - Fallback: INSTALL.bat + app folder (if Smart App Control blocks Setup.exe)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { execSync } from "child_process"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const release = join(root, "release")
const winUnpacked = join(release, "win-unpacked")
const branding = JSON.parse(readFileSync(join(root, "branding.json"), "utf8"))
const slug = String(branding.appName).replace(/\s+/g, "-")
const clientDir = join(release, `${slug}-Client`)
const appDir = join(clientDir, "app")
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version
const zipName = `${slug}-Setup-v${version}.zip`
const zipPath = join(release, zipName)
const appName = branding.appName

if (!existsSync(winUnpacked)) {
  console.error("win-unpacked not found. Run npm run electron:build first.")
  process.exit(1)
}

const setupExe = readdirSync(release).find((f) => f.endsWith(".exe") && f.includes("Setup"))
if (!setupExe) {
  console.error("Setup.exe not found in release/. Check win.target is nsis.")
  process.exit(1)
}

for (const old of ["RestaurantOS-POS-Client", `${slug}-Client`, `${slug}-Setup-v${version}`]) {
  const p = join(release, old)
  if (existsSync(p) && p !== clientDir) rmSync(p, { recursive: true, force: true })
}
if (existsSync(clientDir)) rmSync(clientDir, { recursive: true, force: true })
mkdirSync(appDir, { recursive: true })

cpSync(join(release, setupExe), join(clientDir, setupExe))
cpSync(winUnpacked, appDir, { recursive: true })
for (const file of ["INSTALL.bat", "RUN-POS.bat", "README-SI.txt", "SMART-APP-FIX.txt"]) {
  cpSync(join(root, "installer", file), join(clientDir, file))
}
const appIco = join(root, "build", "icon.ico")
if (existsSync(appIco)) {
  cpSync(appIco, join(clientDir, "app.ico"))
}

const builtAt = new Date().toISOString().replace("T", " ").slice(0, 19)
writeFileSync(
  join(clientDir, "VERSION.txt"),
  `${appName}\r\nVersion: ${version}\r\nBuilt: ${builtAt}\r\n\r\nPrimary install: ${setupExe}\r\nFallback (if blocked): INSTALL.bat\r\n`,
)

if (existsSync(zipPath)) rmSync(zipPath, { force: true })
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${clientDir}\\*' -DestinationPath '${zipPath}' -Force"`,
  { stdio: "inherit" },
)

console.log("")
console.log("Client package ready:")
console.log(`  Setup:  ${join(release, setupExe)}`)
console.log(`  Folder: ${clientDir}`)
console.log(`  Zip:    ${zipPath}`)
console.log("")
console.log(`Give client: ${setupExe}  (or the ZIP if easier to send)`)
