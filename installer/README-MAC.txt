DineMate POS — macOS Install
================================

Primary install:
  Double-click "DineMate POS-1.1.4-mac.dmg" and drag DineMate POS to Applications.

Alternative (ZIP):
  1. Extract DineMate-POS-Mac-Setup-v1.1.4.zip
  2. Run: chmod +x INSTALL-MAC.sh && ./INSTALL-MAC.sh
  3. Open DineMate POS from Applications

First launch (unsigned build):
  If macOS says the app cannot be opened:
  - Right-click DineMate POS → Open → Open again
  - Or: System Settings → Privacy & Security → Open Anyway

After install:
  1. Login to the POS
  2. Settings → Receipt printers → enter exact printer names
  3. Printers: System Settings → Printers & Scanners

Notes:
  - Internet required (API server: 35.223.93.6:8080)
  - Build Mac installer on a Mac: npm run electron:build:mac
  - Silent thermal print works via the desktop app (no QZ Tray needed)

Support: vizualabs.com
