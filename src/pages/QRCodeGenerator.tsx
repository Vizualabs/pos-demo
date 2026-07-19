import { useState } from "react"
import { DashboardLayout } from "@/components/Layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { QRCodeSVG } from "qrcode.react"
import { Download, Printer } from "lucide-react"

const QRCodeGenerator = () => {
  const [tableNumber, setTableNumber] = useState("")
  const baseUrl =
    import.meta.env.VITE_CUSTOMER_APP_URL || "http://localhost:5002"

  const qrValue = tableNumber
    ? `${baseUrl}?table=${encodeURIComponent(tableNumber)}`
    : baseUrl

  const handlePrint = () => {
    const win = window.open("")
    if (!win) return
    win.document.write(`
      <html><head><title>QR Code - Table ${tableNumber || "Menu"}</title>
      <style>body{display:flex;justify-content:center;align-items:center;height:100vh;margin:0}</style>
      </head><body>
      <div style="text-align:center">
        <h2>Table ${tableNumber || "Menu"}</h2>
        ${document.getElementById("qr-code-container")?.innerHTML ?? ""}
        <p style="color:#666;margin-top:8px">Scan to order</p>
      </div>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">QR Code Generator</h1>
          <p className="text-muted-foreground mt-1">
            Generate QR codes for tables to let customers order from their phones
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Table QR Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="table">Table Number</Label>
                <Input
                  id="table"
                  type="number"
                  min={1}
                  placeholder="e.g. 5"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to generate a general menu QR code
                </p>
              </div>

              <div className="space-y-2">
                <Label>Customer App URL</Label>
                <Input value={baseUrl} disabled />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="gap-2" onClick={handlePrint} disabled={!tableNumber}>
                  <Printer className="h-4 w-4" /> Print
                </Button>
                <Button variant="outline" className="gap-2" disabled={!tableNumber}>
                  <Download className="h-4 w-4" /> Download
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div
                id="qr-code-container"
                className="rounded-xl border p-6 bg-white"
              >
                <QRCodeSVG
                  value={qrValue}
                  size={220}
                  level="M"
                  includeMargin
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {tableNumber
                  ? `Table #${tableNumber} — ${baseUrl}?table=${tableNumber}`
                  : baseUrl}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>All Table Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((t) => (
                <div key={t} className="flex flex-col items-center gap-2 p-3 border rounded-lg">
                  <div className="bg-white rounded-lg p-2">
                    <QRCodeSVG value={`${baseUrl}?table=${t}`} size={80} level="M" />
                  </div>
                  <span className="text-sm font-medium">Table {t}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

export default QRCodeGenerator
