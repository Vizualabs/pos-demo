import puppeteer from "puppeteer"
import sharp from "sharp"

/**
 * XPrinter POS-80 / typical 80mm ESC/POS: 576 dots @ 203 DPI.
 * Render narrower then scale up so kitchen type prints larger on the roll.
 */
const PRINT_WIDTH_PX = Number(process.env.PRINT_WIDTH_DOTS) || 576
const RENDER_WIDTH_PX = Number(process.env.PRINT_RENDER_WIDTH) || 432
const RASTER_SCALE = Number(process.env.PRINT_RASTER_SCALE) || PRINT_WIDTH_PX / RENDER_WIDTH_PX

function buildRasterFontOverrides() {
  return `
  html, body {
    width: ${RENDER_WIDTH_PX}px !important;
    max-width: ${RENDER_WIDTH_PX}px !important;
    margin: 0 !important;
    padding: 6px 8px !important;
    font-size: 24px !important;
    line-height: 1.4 !important;
    font-weight: 600 !important;
  }
  .kot-single, .customer-print-section {
    width: 100% !important;
    max-width: 100% !important;
  }
  .kot-title {
    font-size: 38px !important;
    font-weight: 900 !important;
    letter-spacing: 0.5px !important;
    padding-bottom: 8px !important;
  }
  .kot-subtitle { font-size: 18px !important; font-weight: 600 !important; }
  .badge {
    font-size: 22px !important;
    font-weight: 700 !important;
    padding: 8px 16px !important;
  }
  .kot-meta {
    font-size: 20px !important;
    font-weight: 600 !important;
    row-gap: 8px !important;
    column-gap: 10px !important;
  }
  .kot-meta > span:nth-child(even) { font-size: 21px !important; font-weight: 800 !important; }
  .kot-table {
    font-size: 28px !important;
    line-height: 1.45 !important;
    font-weight: 700 !important;
  }
  .kot-table th {
    font-size: 20px !important;
    font-weight: 800 !important;
    padding-bottom: 8px !important;
  }
  .kot-table td {
    padding: 12px 4px !important;
    font-weight: 700 !important;
  }
  .kot-table td:nth-child(2) {
    font-size: 36px !important;
    font-weight: 900 !important;
  }
  .prep-note { font-size: 18px !important; font-weight: 600 !important; }
  .c-brand-name { font-size: 30px !important; font-weight: 900 !important; }
  .customer-print-section table { font-size: 22px !important; }
  .grand-row { font-size: 30px !important; font-weight: 900 !important; }
`
}

let browserPromise = null

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    })
  }
  return browserPromise
}

/** Scale PNG to printer dot width (enlarges kitchen ticket text on XPrinter POS-80). */
async function scaleToPrintWidth(pngBuffer) {
  const meta = await sharp(pngBuffer).metadata()
  const srcW = meta.width ?? RENDER_WIDTH_PX
  const targetW = Math.round(Math.min(PRINT_WIDTH_PX, srcW * RASTER_SCALE))
  if (targetW <= srcW) {
    return sharp(pngBuffer)
      .resize(PRINT_WIDTH_PX, null, { fit: "contain", background: "#ffffff" })
      .png()
      .toBuffer()
  }
  return sharp(pngBuffer)
    .resize(targetW, null, { kernel: sharp.kernel.lanczos3, background: "#ffffff" })
    .extend({
      left: 0,
      right: Math.max(0, PRINT_WIDTH_PX - targetW),
      background: "#ffffff",
    })
    .png()
    .toBuffer()
}

/** @param {Buffer} pngBuffer */
async function pngToEscPosRaster(pngBuffer) {
  const scaled = await scaleToPrintWidth(pngBuffer)

  const { data, info } = await sharp(scaled)
    .flatten({ background: "#ffffff" })
    .grayscale()
    .normalize()
    .threshold(135)
    .raw()
    .toBuffer({ resolveWithObject: true })

  const width = info.width
  const height = info.height
  const bytesPerRow = Math.ceil(width / 8)
  const raster = Buffer.alloc(bytesPerRow * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = data[y * width + x]
      if (pixel < 128) {
        raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
  }

  const xL = bytesPerRow & 0xff
  const xH = (bytesPerRow >> 8) & 0xff
  const yL = height & 0xff
  const yH = (height >> 8) & 0xff

  return Buffer.concat([
    Buffer.from([0x1b, 0x40]), // ESC @ init
    Buffer.from([0x1b, 0x61, 0x00]), // left align — full width for XPrinter
    Buffer.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]),
    raster,
    Buffer.from([0x0a, 0x0a, 0x0a]),
    Buffer.from([0x1d, 0x56, 0x00]),
  ])
}

/**
 * Render receipt HTML to ESC/POS raster bytes for network thermal printers.
 * @param {string} html Full HTML document from receiptPrint.ts
 */
export async function htmlToEscPosBuffer(html) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: RENDER_WIDTH_PX, height: 1400, deviceScaleFactor: 1 })
    await page.setRequestInterception(true)
    page.on("request", (req) => {
      const url = req.url()
      if (url.includes("googleapis.com") || url.includes("gstatic.com")) {
        req.abort()
      } else {
        req.continue()
      }
    })
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 })
    await page.addStyleTag({ content: buildRasterFontOverrides() })
    await page.evaluate(() => document.fonts?.ready)
    const target =
      (await page.$(".kot-single")) ??
      (await page.$(".customer-print-section")) ??
      (await page.$("body"))
    if (!target) throw new Error("Print document has no content")
    const box = await target.boundingBox()
    await target.dispose()
    if (!box || box.width < 1 || box.height < 1) {
      throw new Error("Print document has empty layout")
    }
    const height = Math.min(Math.ceil(box.height + 16), 5000)
    const png = await page.screenshot({
      type: "png",
      clip: {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y),
        width: Math.min(box.width, RENDER_WIDTH_PX),
        height,
      },
      omitBackground: false,
    })
    return pngToEscPosRaster(Buffer.from(png))
  } finally {
    await page.close()
  }
}

export async function closePrintBrowser() {
  if (browserPromise) {
    const b = await browserPromise
    await b.close().catch(() => {})
    browserPromise = null
  }
}
