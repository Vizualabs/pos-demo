# Cloud POS — Network Printer Setup

All three printers (Kitchen 1, Kitchen 2, Cashier bill) connect by **LAN IP** on TCP port **9100**. No USB driver or browser print dialog on the cashier PC.

## How it works

1. Cashier clicks **Print** in the browser.
2. The frontend builds receipt HTML and sends one request to `POST /api/print/jobs`.
3. The Node print server renders each job to ESC/POS and sends to the printer IP.
4. Jobs run in order: **Kitchen 1 → Kitchen 2 → Customer bill**.

## Configure IPs

In **Settings → Receipt printers** (or `PUT /api/print/settings`):

| Field | Example |
|-------|---------|
| Kitchen 1 IP | `192.168.8.200` |
| Kitchen 2 IP | `192.168.8.201` |
| Cashier / customer bill IP | `192.168.8.202` |
| TCP port | `9100` (default) |

Each printer needs a **static IP** on the restaurant LAN (set on the printer or via DHCP reservation).

Test from the PC running the print server:

```powershell
Test-NetConnection 192.168.8.200 -Port 9100
```

## Printer requirements

- Network thermal printer (XPrinter POS-80, Epson, Star, etc.)
- Raw TCP port **9100** enabled
- 80mm roll, 203 DPI

## Cloud → restaurant network (VPN)

If the print server runs in the cloud, it must reach `192.168.x.x` via site-to-site VPN (WireGuard, OpenVPN, etc.). Do not expose port 9100 to the public internet.

For local dev, run the print server on the same LAN as the printers (`npm run dev:all`).

## Local development

```bash
npm run dev:all
```

Health: `curl http://127.0.0.1:3001/health`

## Cashier printer on USB only?

Give the USB printer a **network interface** (WiFi/Ethernet on the device), or use a small print server box that shares USB as `IP:9100`. The POS only supports IP printing in production mode.
