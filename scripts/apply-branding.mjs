/**
 * Reads branding.json and updates package.json + installer scripts before build.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import pngToIco from "png-to-ico"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const branding = JSON.parse(readFileSync(join(root, "branding.json"), "utf8"))
const { appName, installFolder, logoSource, iconPath, appId } = branding

const pkgPath = join(root, "package.json")
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
pkg.build.productName = appName
pkg.build.nsis.shortcutName = appName
if (appId) pkg.build.appId = appId
pkg.build.win = pkg.build.win || {}
pkg.build.win.signAndEditExecutable = false
if (!pkg.build.win.target?.length) pkg.build.win.target = ["nsis"]
pkg.build.artifactName = "${productName} Setup ${version}.${ext}"

const logoSrc = logoSource ? join(root, logoSource) : null
const iconDest = join(root, iconPath)
if (logoSrc && existsSync(logoSrc)) {
  mkdirSync(dirname(iconDest), { recursive: true })
  copyFileSync(logoSrc, iconDest)
  console.log(`Icon copied: ${logoSource} → ${iconPath}`)
}

const iconIco = join(root, "build/icon.ico")
const iconFull = join(root, iconPath)
if (existsSync(iconFull)) {
  try {
    const buf = await pngToIco(iconFull)
    writeFileSync(iconIco, buf)
    console.log("Icon ICO generated: build/icon.ico")
    pkg.build.win.icon = "build/icon.ico"
  } catch (e) {
    console.warn("ICO generation failed, using PNG:", e instanceof Error ? e.message : e)
    pkg.build.win.icon = iconPath.replace(/\\/g, "/")
  }
} else if (existsSync(iconIco)) {
  pkg.build.win.icon = "build/icon.ico"
} else {
  delete pkg.build.win.icon
}

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")

const exeName = `${appName}.exe`
const installBat = `@echo off
chcp 65001 >nul
title ${appName} - Install
setlocal EnableExtensions

set "INSTALL_DIR=%LOCALAPPDATA%\\${installFolder}"
set "SOURCE_DIR=%~dp0app"
set "LAUNCHER=%INSTALL_DIR%\\RUN-POS.bat"
set "SOURCE_LAUNCHER=%~dp0RUN-POS.bat"
set "EXE_NAME=${exeName}"

echo.
echo ==========================================
echo   ${appName} - Install
echo ==========================================
echo.
if exist "%~dp0VERSION.txt" type "%~dp0VERSION.txt"
echo.
echo Installing to:
echo   %INSTALL_DIR%
echo.

if not exist "%SOURCE_DIR%\\%EXE_NAME%" (
  echo [ERROR] App files not found.
  echo Make sure the "app" folder is next to INSTALL.bat.
  pause
  exit /b 1
)

taskkill /F /IM "%EXE_NAME%" >nul 2>&1
taskkill /F /IM "RestaurantOS POS.exe" >nul 2>&1
taskkill /F /IM "electron.exe" >nul 2>&1

echo Removing old shortcuts...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$desk=[Environment]::GetFolderPath('Desktop');" ^
  "@('RestaurantOS POS.lnk','electron.lnk') | ForEach-Object { $p=Join-Path $desk $_; if (Test-Path $p) { Remove-Item $p -Force } }" >nul 2>&1

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo Copying files...
xcopy /E /I /Y /Q "%SOURCE_DIR%\\*" "%INSTALL_DIR%\\" >nul
if errorlevel 1 (
  echo [ERROR] Copy failed. Close ${appName} and try again.
  pause
  exit /b 1
)

copy /Y "%SOURCE_LAUNCHER%" "%LAUNCHER%" >nul
if exist "%~dp0app.ico" copy /Y "%~dp0app.ico" "%INSTALL_DIR%\\app.ico" >nul

echo Removing Windows download block...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-ChildItem -LiteralPath '%INSTALL_DIR%' -Recurse -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue; Unblock-File -LiteralPath '%LAUNCHER%' -ErrorAction SilentlyContinue" >nul 2>&1

echo Creating Desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$icon = if (Test-Path '%INSTALL_DIR%\\app.ico') { '%INSTALL_DIR%\\app.ico' } else { '%INSTALL_DIR%\\%EXE_NAME%,0' };" ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop') + '\\${appName}.lnk');" ^
  "$s.TargetPath = '%LAUNCHER%';" ^
  "$s.WorkingDirectory = '%INSTALL_DIR%';" ^
  "$s.IconLocation = $icon;" ^
  "$s.Description = '${appName}';" ^
  "$s.Save()"

echo.
echo ==========================================
echo   Install complete!
echo ==========================================
echo.
echo Open "${appName}" from Desktop.
echo.
pause
`

const runBat = `@echo off
chcp 65001 >nul
title ${appName}
setlocal EnableExtensions

set "INSTALL_DIR=%LOCALAPPDATA%\\${installFolder}"
set "EXE=%INSTALL_DIR%\\${exeName}"

if not exist "%EXE%" (
  echo ${appName} is not installed.
  echo Run INSTALL.bat first.
  pause
  exit /b 1
)

cd /d "%INSTALL_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-ChildItem -LiteralPath '%INSTALL_DIR%' -Recurse -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1

start "" "%EXE%"
`

writeFileSync(join(root, "installer", "INSTALL.bat"), installBat)
writeFileSync(join(root, "installer", "RUN-POS.bat"), runBat)

const version = pkg.version || "0.0.0"
const slug = String(appName).replace(/\s+/g, "-")
const setupFile = `${appName} Setup ${version}.exe`
const readmeSi = `${appName} — Install කරන විදිහ
=====================================

✅ ප්‍රධාන විදිහ: "${setupFile}" double-click කරන්න.

⚠️ Setup.exe block වෙනවා නම් — ZIP extract කරලා INSTALL.bat use කරන්න.

පියවර:
1. පරණ "RestaurantOS POS" shortcut එක Desktop එකෙන් delete කරන්න
2. "${setupFile}" run කරන්න (හෝ ${slug}-Setup-v${version}.zip extract කරන්න)
3. VERSION.txt බලන්න — version ${version} වෙන්න ඕනේ
4. Install wizard complete කරන්න
5. Desktop එකේ "${appName}" shortcut open කරන්න
6. Login කරන්න
7. Settings → Receipt printers → printer names Save කරන්න

Setup block වෙනවා නම් SMART-APP-FIX.txt කියවන්න.

Printers:
- Windows Settings → Printers වල printers add කරන්න
- App Settings එකේ "Show Windows printers" → exact names copy කරන්න

සටහන:
- Internet ඕනේ (server: 35.223.93.6)
- App එක browser වගේ server UI load කරනවා
- QZ Tray / print-agent install කරන්න ඕනේ නෑ

Support: vizualabs.com
`
writeFileSync(join(root, "installer", "README-SI.txt"), readmeSi)

const smartFix = `Windows "Smart App Control blocked" — විසඳුම
=============================================

සාමාන්‍යයෙන් "${setupFile}" run කරන්න.
Block වෙනවා නම් මේ fallback use කරන්න:

1. ${slug}-Setup-v${version}.zip extract කරන්න
2. INSTALL.bat double-click කරන්න (Setup.exe නෙවෙයි)
3. Desktop shortcut open කරන්න

තවමත් block වෙනවා නම් — Smart App Control Off කරන්න:

1. Start → Settings (Windows Settings)
2. Privacy & security
3. Windows Security
4. App & browser control
5. Smart App Control settings
6. "Off" select කරන්න
7. PC restart කරන්න (ඉල්ලුවොත්)
8. INSTALL.bat නැවත run කරන්න

Alternative (file unblock only):
- Install folder: %LOCALAPPDATA%\\${installFolder}
- ${exeName} → Right-click → Properties → Unblock → Apply

Client එකට ප්‍රධානව "${setupFile}" දෙන්න.
Block වෙනවා නම් ZIP + INSTALL.bat fallback දෙන්න.
`
writeFileSync(join(root, "installer", "SMART-APP-FIX.txt"), smartFix)

console.log(`Branding applied: "${appName}"`)
console.log(`Icon: ${pkg.build.win?.icon ?? "(default)"}`)
