@echo off
chcp 65001 >nul
title DineMate POS - Install
setlocal EnableExtensions

set "INSTALL_DIR=%LOCALAPPDATA%\DineMate POS"
set "SOURCE_DIR=%~dp0app"
set "LAUNCHER=%INSTALL_DIR%\RUN-POS.bat"
set "SOURCE_LAUNCHER=%~dp0RUN-POS.bat"
set "EXE_NAME=DineMate POS.exe"

echo.
echo ==========================================
echo   DineMate POS - Install
echo ==========================================
echo.
if exist "%~dp0VERSION.txt" type "%~dp0VERSION.txt"
echo.
echo Installing to:
echo   %INSTALL_DIR%
echo.

if not exist "%SOURCE_DIR%\%EXE_NAME%" (
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
xcopy /E /I /Y /Q "%SOURCE_DIR%\*" "%INSTALL_DIR%\" >nul
if errorlevel 1 (
  echo [ERROR] Copy failed. Close DineMate POS and try again.
  pause
  exit /b 1
)

copy /Y "%SOURCE_LAUNCHER%" "%LAUNCHER%" >nul
if exist "%~dp0app.ico" copy /Y "%~dp0app.ico" "%INSTALL_DIR%\app.ico" >nul

echo Removing Windows download block...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-ChildItem -LiteralPath '%INSTALL_DIR%' -Recurse -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue; Unblock-File -LiteralPath '%LAUNCHER%' -ErrorAction SilentlyContinue" >nul 2>&1

echo Creating Desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$icon = if (Test-Path '%INSTALL_DIR%\app.ico') { '%INSTALL_DIR%\app.ico' } else { '%INSTALL_DIR%\%EXE_NAME%,0' };" ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop') + '\DineMate POS.lnk');" ^
  "$s.TargetPath = '%LAUNCHER%';" ^
  "$s.WorkingDirectory = '%INSTALL_DIR%';" ^
  "$s.IconLocation = $icon;" ^
  "$s.Description = 'DineMate POS';" ^
  "$s.Save()"

echo.
echo ==========================================
echo   Install complete!
echo ==========================================
echo.
echo Open "DineMate POS" from Desktop.
echo.
pause
