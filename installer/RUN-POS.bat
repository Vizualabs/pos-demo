@echo off
chcp 65001 >nul
title DineMate POS
setlocal EnableExtensions

set "INSTALL_DIR=%LOCALAPPDATA%\DineMate POS"
set "EXE=%INSTALL_DIR%\DineMate POS.exe"

if not exist "%EXE%" (
  echo DineMate POS is not installed.
  echo Run INSTALL.bat first.
  pause
  exit /b 1
)

cd /d "%INSTALL_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-ChildItem -LiteralPath '%INSTALL_DIR%' -Recurse -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1

start "" "%EXE%"
