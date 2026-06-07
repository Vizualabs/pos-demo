/**
 * After electron-builder on macOS, bundle client deliverables:
 * - Primary: DineMate POS-X.X.X-mac.dmg
 * - Fallback: INSTALL-MAC.sh + app bundle folder
 */
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { execSync } from "child_process"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const release = join(root, "release")
const branding = JSON.parse(readFileSync(join(root, "branding.json"), "utf8"))
const slug = String(branding.appName).replace(/\s+/g, "-")
const appName = branding.appName
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version
const clientDir = join(release, `${slug}-Client-Mac`)
const appDir = join(clientDir, "app")
const zipName = `${slug}-Mac-Setup-v${version}.zip`
const zipPath = join(release, zipName)

const macUnpackedCandidates = ["mac-arm64", "mac", "mac-x64"].map((d) => join(release, d))
const macUnpacked = macUnpackedCandidates.find((p) => existsSync(p))
if (!macUnpacked) {
  console.error("mac-arm64 / mac folder not found. Run npm run electron:build:mac on macOS.")
  process.exit(1)
}

const appBundle = join(macUnpacked, `${appName}.app`)
if (!existsSync(appBundle)) {
  console.error(`App bundle not found: ${appBundle}`)
  process.exit(1)
}

const dmgFile =
  readdirSync(release).find((f) => f.endsWith(".dmg") && f.includes(String(version))) ||
  readdirSync(release).find((f) => f.endsWith(".dmg"))
if (!dmgFile) {
  console.error("DMG not found in release/. Check mac.target includes dmg.")
  process.exit(1)
}

for (const old of [`${slug}-Client-Mac`, `${slug}-Mac-Setup-v${version}`]) {
  const p = join(release, old)
  if (existsSync(p) && p !== clientDir) rmSync(p, { recursive: true, force: true })
}
if (existsSync(clientDir)) rmSync(clientDir, { recursive: true, force: true })
mkdirSync(appDir, { recursive: true })

cpSync(join(release, dmgFile), join(clientDir, dmgFile))
cpSync(appBundle, join(appDir, `${appName}.app`), { recursive: true })
for (const file of ["INSTALL-MAC.sh", "README-MAC.txt"]) {
  cpSync(join(root, "installer", file), join(clientDir, file))
}
chmodSync(join(clientDir, "INSTALL-MAC.sh"), 0o755)

const builtAt = new Date().toISOString().replace("T", " ").slice(0, 19)
writeFileSync(
  join(clientDir, "VERSION.txt"),
  `${appName} (macOS)\r\nVersion: ${version}\r\nBuilt: ${builtAt}\r\n\r\nPrimary install: ${dmgFile}\r\nFallback: INSTALL-MAC.sh\r\n`,
)

if (existsSync(zipPath)) rmSync(zipPath, { force: true })
execSync(`cd "${release}" && zip -r "${zipName}" "${slug}-Client-Mac}"`, { stdio: "inherit" })

console.log("")
console.log("Mac client package ready:")
console.log(`  DMG:    ${join(release, dmgFile)}`)
console.log(`  Folder: ${clientDir}`)
console.log(`  Zip:    ${zipPath}`)
console.log("")
console.log(`Give Mac client: ${dmgFile}  (or the ZIP if easier to send)`)
