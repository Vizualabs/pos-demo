#!/bin/bash
set -euo pipefail

APP_NAME="DineMate POS.app"
INSTALL_DIR="/Applications"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)/app"

echo ""
echo "=========================================="
echo "  DineMate POS - Install (macOS)"
echo "=========================================="
echo ""
if [ -f "$SOURCE_DIR/../VERSION.txt" ]; then cat "$SOURCE_DIR/../VERSION.txt"; fi
echo ""
echo "Installing to: $INSTALL_DIR/$APP_NAME"
echo ""

if [ ! -d "$SOURCE_DIR/$APP_NAME" ]; then
  echo "[ERROR] App bundle not found in ./app/"
  echo "Extract the full client ZIP first."
  exit 1
fi

if [ -d "$INSTALL_DIR/$APP_NAME" ]; then
  echo "Removing previous install..."
  rm -rf "$INSTALL_DIR/$APP_NAME"
fi

echo "Copying app..."
ditto "$SOURCE_DIR/$APP_NAME" "$INSTALL_DIR/$APP_NAME"
xattr -cr "$INSTALL_DIR/$APP_NAME" 2>/dev/null || true

echo ""
echo "=========================================="
echo "  Install complete!"
echo "=========================================="
echo ""
echo "Open DineMate POS from Applications."
echo "First launch: if macOS blocks the app, right-click → Open."
echo ""
