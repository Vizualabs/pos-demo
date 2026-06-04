import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { CustomerInvoice } from '@/lib/invoicesApi'
import type { CustomerMealInvoiceDocument } from '@/lib/customerMealInvoicesApi'
import { formatCurrency } from '@/lib/utils'

// Matches POS / dashboard theme (index.css --primary & --sidebar-background)
const COLORS = {
  primary: { r: 31, g: 122, b: 74 },     // hsl(148 60% 32%) brand green
  primaryDark: { r: 20, g: 99, b: 58 },  // hsl(150 65% 22%) sidebar green
  dark: { r: 15, g: 23, b: 42 },
  light: { r: 241, g: 245, b: 249 },
  border: { r: 226, g: 232, b: 240 },
  accent: { r: 40, g: 140, b: 86 },      // lighter brand green
  success: { r: 34, g: 197, b: 94 },     // PAID badge
  pending: { r: 202, g: 138, b: 4 },
  text: { r: 51, g: 65, b: 85 },
  muted: { r: 100, g: 116, b: 139 },
}

const BRAND = {
  restaurantName: 'Madara Restaurant',
  poweredBy: 'Powered by VIZUALABS',
  website: 'www.vizualabs.com',
}

const LOGO_PATHS = ['/madara-logo.jpg', '/madara-restaurant-logo.png'] as const

type LogoAsset = { data: string; format: 'JPEG' | 'PNG' }

/** Load restaurant logo from public/ for PDF headers */
async function getLogoBase64(): Promise<LogoAsset | null> {
  for (const path of LOGO_PATHS) {
    try {
      const response = await fetch(path)
      if (!response.ok) continue
      const blob = await response.blob()
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to read logo'))
        reader.readAsDataURL(blob)
      })
      const format = path.endsWith('.png') ? 'PNG' : 'JPEG'
      return { data, format }
    } catch {
      continue
    }
  }
  return null
}

/** Footer on every page — Madara + VIZUALABS */
function addVizulabsFooter(pdf: jsPDF, centerNote?: string): void {
  const W = 210
  const pageCount = pdf.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b)
    pdf.setLineWidth(0.3)
    pdf.line(15, 281, 195, 281)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)
    const footerY = 288
    if (centerNote?.trim()) {
      pdf.text(centerNote, W / 2, footerY - 3, { align: 'center' })
    }
    pdf.text(BRAND.restaurantName, 15, footerY)
    pdf.text(BRAND.poweredBy, W / 2, footerY, { align: 'center' })
    pdf.text(BRAND.website, 195, footerY, { align: 'right' })
  }
}

/** Green top bar with optional logo + title */
function drawBrandedTopBar(
  pdf: jsPDF,
  opts: { title: string; rightText?: string; logo: LogoAsset | null },
): void {
  const W = 210
  const M = { L: 15, R: 15 }
  const barH = 28

  pdf.setFillColor(COLORS.primaryDark.r, COLORS.primaryDark.g, COLORS.primaryDark.b)
  pdf.rect(0, 0, W, barH, 'F')

  let titleX = M.L
  if (opts.logo) {
    try {
      pdf.addImage(opts.logo.data, opts.logo.format, M.L, 5, 18, 18)
      titleX = M.L + 22
    } catch (e) {
      console.warn('Could not add logo to PDF:', e)
    }
  }

  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(24)
  pdf.text(opts.title, titleX, 19)

  if (opts.rightText) {
    pdf.setFont('courier', 'normal')
    pdf.setFontSize(10)
    pdf.text(opts.rightText, W - M.R, 19, { align: 'right' })
  }
}

/** Status pill — ASCII only (Helvetica cannot render ✓ / ⟳ reliably) */
function drawStatusPill(
  pdf: jsPDF,
  x: number,
  y: number,
  label: 'PAID' | 'UNPAID' | 'PENDING',
  paid: boolean,
): number {
  const pillH = 8
  const padX = 7
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  if (paid) {
    pdf.setFillColor(COLORS.success.r, COLORS.success.g, COLORS.success.b)
  } else {
    pdf.setFillColor(COLORS.pending.r, COLORS.pending.g, COLORS.pending.b)
  }
  pdf.setTextColor(255, 255, 255)
  const textW = pdf.getTextWidth(label)
  const pillW = Math.max(textW + padX * 2, 24)
  pdf.roundedRect(x, y, pillW, pillH, 1.5, 1.5, 'F')
  pdf.text(label, x + pillW / 2, y + pillH * 0.62, { align: 'center' })
  pdf.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b)
  return pillH
}

export type GeneratePdfOptions = {
  fixOffscreenClone?: boolean
  marginMm?: number
  hideChromeInClone?: boolean
}

export const generatePDF = async (
  elementId: string,
  filename: string = 'report.pdf',
  options?: GeneratePdfOptions,
) => {
  const element = document.getElementById(elementId)
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`)
  }

  const marginMm = options?.marginMm ?? 10
  const hideChrome = options?.hideChromeInClone !== false

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (_clonedDoc, clonedElement) => {
        if (clonedElement instanceof HTMLElement) {
          if (hideChrome) {
            clonedElement.querySelectorAll('.pdf-hide').forEach((el) => {
              ;(el as HTMLElement).style.setProperty('display', 'none', 'important')
            })
          }
        }
        if (!options?.fixOffscreenClone || !(clonedElement instanceof HTMLElement)) return
        clonedElement.style.position = 'relative'
        clonedElement.style.left = '0'
        clonedElement.style.top = '0'
        clonedElement.style.transform = 'none'
        clonedElement.style.zIndex = '0'
      },
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')

    const pageW = 210
    const pageH = 295
    const imgWidth = pageW - marginMm * 2
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight
    let position = 0

    pdf.addImage(imgData, 'PNG', marginMm, position, imgWidth, imgHeight)
    heightLeft -= pageH

    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', marginMm, position, imgWidth, imgHeight)
      heightLeft -= pageH
    }

    pdf.save(filename)
  } catch (error) {
    console.error('Error generating PDF:', error)
    throw error
  }
}

function formatInvoiceDatePdf(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const date = d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

/** Professional customer invoice PDF with modern design */
export async function generateCustomerInvoicePdf(invoice: CustomerInvoice): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const W = 210
  const M = { L: 15, R: 15, T: 12 }
  const innerW = W - M.L - M.R
  let y = M.T
  const isPaid = invoice.status === 'paid'
  const bottomSafe = 275
  const logo = await getLogoBase64()

  const newPageIfNeeded = (needMm: number) => {
    if (y + needMm > bottomSafe) {
      pdf.addPage()
      y = M.T
    }
  }

  drawBrandedTopBar(pdf, { title: 'Invoice', rightText: invoice.invoiceId, logo })
  y = 35

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b)
  pdf.text(BRAND.restaurantName, W - M.R, y, { align: 'right' })
  y += 5

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)
  pdf.text('Catering & restaurant services', W - M.R, y, { align: 'right' })
  y += 3
  pdf.text('Sri Lanka', W - M.R, y, { align: 'right' })
  y += 8

  // Two-column info section
  const colWidth = innerW / 2 - 2

  // Bill to section
  pdf.setFillColor(COLORS.light.r, COLORS.light.g, COLORS.light.b)
  pdf.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b)
  pdf.setLineWidth(0.5)
  pdf.rect(M.L, y, colWidth, 28, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)
  pdf.text('BILL TO', M.L + 3, y + 4)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b)
  const billLines = pdf.splitTextToSize(invoice.customerName, colWidth - 6)
  pdf.text(billLines, M.L + 3, y + 9)

  // Date section
  const xDate = M.L + colWidth + 4
  pdf.setFillColor(255, 255, 255)
  pdf.rect(xDate, y, colWidth, 28, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)
  pdf.text('ISSUE DATE', xDate + 3, y + 4)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b)
  const dateStr = formatInvoiceDatePdf(invoice.createdAt)
  const dateLines = pdf.splitTextToSize(dateStr, colWidth - 6)
  pdf.text(dateLines, xDate + 3, y + 9)

  y += 32

  newPageIfNeeded(10)
  y += drawStatusPill(pdf, M.L, y, isPaid ? 'PAID' : 'PENDING', isPaid) + 4

  // Table header
  newPageIfNeeded(14)
  pdf.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b)
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  
  const colQtyRight = M.L + innerW - 92
  const colUnitRight = M.L + innerW - 48
  const colRight = M.L + innerW - 3

  pdf.rect(M.L, y, innerW, 7, 'F')
  pdf.text('DESCRIPTION', M.L + 3, y + 4.5)
  pdf.text('QTY', colQtyRight, y + 4.5, { align: 'right' })
  pdf.text('UNIT PRICE', colUnitRight, y + 4.5, { align: 'right' })
  pdf.text('AMOUNT', colRight, y + 4.5, { align: 'right' })
  y += 7

  // Table rows
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)
  const descMaxW = innerW - 68

  let rowIndex = 0
  for (const line of invoice.lines) {
    const descParts = pdf.splitTextToSize(line.description, descMaxW)
    const lineBlockH = Math.max(8, descParts.length * 4.5 + 3)
    newPageIfNeeded(lineBlockH + 1)

    // Alternate row background
    if (rowIndex % 2 === 0) {
      pdf.setFillColor(COLORS.light.r, COLORS.light.g, COLORS.light.b)
      pdf.rect(M.L, y, innerW, lineBlockH, 'F')
    }

    pdf.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)
    pdf.text(descParts, M.L + 3, y + 4)
    pdf.text(String(line.qty), colQtyRight, y + 4, { align: 'right' })
    pdf.text(formatCurrency(line.unitPrice), colUnitRight, y + 4, { align: 'right' })
    pdf.text(formatCurrency(line.lineTotal), colRight, y + 4, { align: 'right' })
    
    y += lineBlockH
    rowIndex++
  }

  y += 6
  newPageIfNeeded(30)

  // Total section
  const totalW = 85
  const totalX = M.L + innerW - totalW
  
  pdf.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b)
  pdf.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b)
  pdf.roundedRect(totalX, y, totalW, 26, 2, 2, 'F')
  
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(255, 255, 255)
  pdf.text(isPaid ? 'TOTAL PAID' : 'AMOUNT DUE', totalX + 4, y + 6.5)
  
  pdf.setFontSize(18)
  pdf.text(formatCurrency(invoice.total), totalX + totalW - 4, y + 16, { align: 'right' })
  
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  const note = isPaid ? 'Payment received' : 'Please settle by due date'
  pdf.text(note, totalX + 4, y + 20.5)

  y += 32
  newPageIfNeeded(10)

  // Footer separator
  pdf.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b)
  pdf.setLineWidth(0.3)
  pdf.line(M.L, y, M.L + innerW, y)
  y += 6

  addVizulabsFooter(pdf, 'Thank you for your business.')

  const safeFile = `${invoice.invoiceId.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
  pdf.save(safeFile)
}

/** Professional customer meal invoice PDF */
export async function generateCustomerMealInvoicePdf(invoice: CustomerMealInvoiceDocument): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const W = 210
  const M = { L: 15, R: 15, T: 12 }
  const innerW = W - M.L - M.R
  let y = M.T
  const bottomSafe = 275
  const logo = await getLogoBase64()

  const newPageIfNeeded = (needMm: number) => {
    if (y + needMm > bottomSafe) {
      pdf.addPage()
      y = M.T
    }
  }

  const isPaid = invoice.status === 'PAID'
  const invoiceNo = String(invoice.invoiceNo || invoice.invoiceId)

  drawBrandedTopBar(pdf, { title: 'Meal Invoice', rightText: invoiceNo, logo })
  y = 35

  // Two column info
  const colWidth = innerW / 2 - 2
  
  const cust = String(invoice.customerName ?? '').trim() || 'Customer'
  const dateStr = formatInvoiceDatePdf(invoice.createdAt)
  const paidAtStr = invoice.paidAt ? formatInvoiceDatePdf(invoice.paidAt) : '-'

  // Customer section
  pdf.setFillColor(COLORS.light.r, COLORS.light.g, COLORS.light.b)
  pdf.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b)
  pdf.setLineWidth(0.5)
  pdf.rect(M.L, y, colWidth, 26, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)
  pdf.text('CUSTOMER', M.L + 3, y + 4)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b)
  const custLines = pdf.splitTextToSize(cust, colWidth - 6)
  pdf.text(custLines, M.L + 3, y + 9)

  // Date section
  const xDate = M.L + colWidth + 4
  pdf.setFillColor(255, 255, 255)
  pdf.rect(xDate, y, colWidth, 26, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)
  pdf.text('ISSUE DATE', xDate + 3, y + 4)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b)
  const dateLines = pdf.splitTextToSize(dateStr, colWidth - 6)
  pdf.text(dateLines, xDate + 3, y + 9)

  y += 30

  newPageIfNeeded(10)
  y += drawStatusPill(pdf, M.L, y, isPaid ? 'PAID' : 'UNPAID', isPaid) + 4

  // Meal details table — fixed column grid (header + values share same anchors)
  type MealTableCol = { x: number; w: number; align: 'left' | 'center' | 'right' }
  const tableX = M.L
  const mealCols: Record<'meal' | 'qty' | 'unit' | 'total', MealTableCol> = {
    meal: { x: tableX, w: 70, align: 'left' },
    qty: { x: tableX + 70, w: 24, align: 'center' },
    unit: { x: tableX + 94, w: 46, align: 'right' },
    total: { x: tableX + 140, w: innerW - 140, align: 'right' },
  }

  const drawMealCell = (
    text: string,
    col: MealTableCol,
    baselineY: number,
    opts?: { maxWidth?: number },
  ) => {
    const pad = 3
    const anchorX =
      col.align === 'left' ? col.x + pad : col.align === 'right' ? col.x + col.w - pad : col.x + col.w / 2
    const maxW = (opts?.maxWidth ?? col.w) - pad * 2
    const lines = maxW > 8 ? pdf.splitTextToSize(text, maxW) : [text]
    pdf.text(lines, anchorX, baselineY, { align: col.align })
    return lines.length
  }

  newPageIfNeeded(14)
  const headerH = 7
  pdf.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b)
  pdf.rect(tableX, y, innerW, headerH, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  drawMealCell('MEAL TYPE', mealCols.meal, y + 4.5)
  drawMealCell('QTY', mealCols.qty, y + 4.5)
  drawMealCell('UNIT PRICE', mealCols.unit, y + 4.5)
  drawMealCell('TOTAL', mealCols.total, y + 4.5)
  y += headerH

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)

  const lineRows = invoice.lines.length > 0 ? invoice.lines : []
  let stripe = false
  for (const line of lineRows) {
    const mealLines = pdf.splitTextToSize(String(line.mealType), mealCols.meal.w - 6)
    const rowH = Math.max(9, mealLines.length * 4.8 + 4)
    newPageIfNeeded(rowH + 2)

    if (stripe) {
      pdf.setFillColor(COLORS.light.r, COLORS.light.g, COLORS.light.b)
      pdf.rect(tableX, y, innerW, rowH, 'F')
    }
    stripe = !stripe

    const rowTextY = y + 5 + (mealLines.length > 1 ? 0 : 0.5)
    pdf.text(mealLines, mealCols.meal.x + 3, rowTextY)
    drawMealCell(String(line.quantity), mealCols.qty, y + rowH / 2 + 1)
    drawMealCell(formatCurrency(line.unitPrice), mealCols.unit, y + rowH / 2 + 1)
    drawMealCell(formatCurrency(line.lineTotal), mealCols.total, y + rowH / 2 + 1)
    y += rowH
  }
  y += 8

  // Total summary
  newPageIfNeeded(20)
  const totalW = 85
  const totalX = M.L + innerW - totalW
  
  pdf.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b)
  pdf.roundedRect(totalX, y, totalW, 22, 2, 2, 'F')
  
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(255, 255, 255)
  pdf.text('TOTAL AMOUNT', totalX + 4, y + 6)
  
  pdf.setFontSize(16)
  pdf.text(formatCurrency(invoice.total), totalX + totalW - 4, y + 15, { align: 'right' })

  y += 26
  newPageIfNeeded(8)

  if (invoice.paidAt) {
    pdf.setFontSize(8)
    pdf.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)
    pdf.text(`Paid on: ${paidAtStr}`, M.L, y)
  }

  addVizulabsFooter(pdf)

  const safeFile = `${invoiceNo.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
  pdf.save(safeFile)
}

export const generateSalesReport = async (data: any[]) => {
  const pdf = new jsPDF()
  const W = 210
  const M = { L: 15, R: 15, T: 12 }
  const innerW = W - M.L - M.R
  let y = M.T
  const logo = await getLogoBase64()

  drawBrandedTopBar(pdf, { title: 'Sales Report', logo })
  y = 35
  
  pdf.setFontSize(9)
  pdf.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, M.L, y)
  
  y += 12

  // Table header
  pdf.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b)
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.rect(M.L, y, innerW, 7, 'F')
  
  pdf.text('Item', M.L + 3, y + 4.5)
  pdf.text('Quantity', M.L + 65, y + 4.5)
  pdf.text('Price', M.L + 110, y + 4.5)
  pdf.text('Total', M.L + innerW - 3, y + 4.5, { align: 'right' })
  
  y += 7

  // Table rows
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)

  data.forEach((item, index) => {
    if (y > 270) {
      pdf.addPage()
      y = M.T
    }
    
    if (index % 2 === 0) {
      pdf.setFillColor(COLORS.light.r, COLORS.light.g, COLORS.light.b)
      pdf.rect(M.L, y, innerW, 8, 'F')
    }
    
    pdf.text(item.name || 'Item', M.L + 3, y + 4.5)
    pdf.text((item.quantity || 0).toString(), M.L + 65, y + 4.5)
    pdf.text(`$${(item.price || 0).toFixed(2)}`, M.L + 110, y + 4.5)
    pdf.text(`$${((item.quantity || 0) * (item.price || 0)).toFixed(2)}`, M.L + innerW - 3, y + 4.5, { align: 'right' })
    
    y += 8
  })

  addVizulabsFooter(pdf)
  pdf.save('sales-report.pdf')
}

export const generateInventoryReport = async (data: any[]) => {
  const pdf = new jsPDF()
  const W = 210
  const M = { L: 15, R: 15, T: 12 }
  const innerW = W - M.L - M.R
  let y = M.T
  const logo = await getLogoBase64()

  drawBrandedTopBar(pdf, { title: 'Inventory Report', logo })
  y = 35
  
  pdf.setFontSize(9)
  pdf.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, M.L, y)
  
  y += 12

  // Table header
  pdf.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b)
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.rect(M.L, y, innerW, 7, 'F')
  
  pdf.text('Item', M.L + 3, y + 4.5)
  pdf.text('Category', M.L + 60, y + 4.5)
  pdf.text('Stock', M.L + 115, y + 4.5)
  pdf.text('Price', M.L + innerW - 3, y + 4.5, { align: 'right' })
  
  y += 7

  // Table rows
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)

  data.forEach((item, index) => {
    if (y > 270) {
      pdf.addPage()
      y = M.T
    }
    
    if (index % 2 === 0) {
      pdf.setFillColor(COLORS.light.r, COLORS.light.g, COLORS.light.b)
      pdf.rect(M.L, y, innerW, 8, 'F')
    }
    
    pdf.text(item.name || 'Item', M.L + 3, y + 4.5)
    pdf.text(item.category || 'Category', M.L + 60, y + 4.5)
    pdf.text((item.stock || 0).toString(), M.L + 115, y + 4.5)
    pdf.text(`$${(item.price || 0).toFixed(2)}`, M.L + innerW - 3, y + 4.5, { align: 'right' })
    
    y += 8
  })

  addVizulabsFooter(pdf)
  pdf.save('inventory-report.pdf')
}

export type SalarySlipPdfInput = {
  employeeName: string
  employeeId: string
  role: string
  periodYm: string
  paymentPerDay: number
  present: number
  leave: number
  absent: number
  paidLeaveDays: number
  unpaidLeaveDays: number
  paidDays: number
  grossLkr: number
  deductionLkr: number
  netLkr: number
}

/** Professional salary slip with modern design */
export async function generateSalarySlipPdf(data: SalarySlipPdfInput): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const W = 210
  const M = { L: 15, R: 15, T: 12 }
  const innerW = W - M.L - M.R
  let y = M.T
  const logo = await getLogoBase64()

  const periodHuman =
    data.periodYm.length >= 7
      ? new Date(`${data.periodYm}-01T12:00:00`).toLocaleString(undefined, { month: 'long', year: 'numeric' })
      : data.periodYm

  drawBrandedTopBar(pdf, { title: 'Salary Slip', rightText: periodHuman, logo })
  y = 38

  // Employee info section
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b)

  const infoItems = [
    { label: 'Employee', value: data.employeeName },
    { label: 'Employee ID', value: data.employeeId },
    { label: 'Role', value: data.role },
    { label: 'Pay Period', value: periodHuman },
  ]

  infoItems.forEach((item) => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)
    pdf.text(item.label, M.L, y)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)
    pdf.text(item.value, M.L + 50, y)
    y += 6
  })

  y += 4

  // Attendance section
  pdf.setFillColor(COLORS.light.r, COLORS.light.g, COLORS.light.b)
  pdf.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b)
  pdf.setLineWidth(0.5)
  pdf.rect(M.L, y, innerW, 1, 'FD')
  y += 4

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b)
  pdf.text('ATTENDANCE', M.L, y)
  y += 7

  const attendanceItems = [
    { label: 'Present Days', value: String(data.present) },
    { label: 'Leave Days', value: String(data.leave) },
    { label: 'Absent Days', value: String(data.absent) },
    { label: 'Paid Leave (Capped)', value: String(data.paidLeaveDays) },
    { label: 'Unpaid Leave', value: String(data.unpaidLeaveDays) },
    { label: 'Total Paid Days', value: String(data.paidDays) },
  ]

  attendanceItems.forEach((item, index) => {
    if (index % 2 === 0) {
      pdf.setFillColor(COLORS.light.r, COLORS.light.g, COLORS.light.b)
      pdf.rect(M.L, y - 1, innerW, 6, 'F')
    }

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)
    pdf.text(item.label, M.L + 3, y + 2)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)
    pdf.text(item.value, M.L + innerW - 3, y + 2, { align: 'right' })
    y += 6
  })

  y += 4

  // Earnings section
  pdf.setFillColor(COLORS.light.r, COLORS.light.g, COLORS.light.b)
  pdf.rect(M.L, y, innerW, 1, 'FD')
  y += 4

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b)
  pdf.text('EARNINGS & DEDUCTIONS', M.L, y)
  y += 7

  const earningsItems = [
    { label: 'Payment per Day', value: `LKR ${data.paymentPerDay.toFixed(2)}` },
    { label: 'Gross Pay', value: `LKR ${data.grossLkr.toFixed(2)}` },
    { label: 'Deductions (Loan/Advance)', value: `LKR ${data.deductionLkr.toFixed(2)}` },
  ]

  earningsItems.forEach((item, index) => {
    if (index % 2 === 0) {
      pdf.setFillColor(COLORS.light.r, COLORS.light.g, COLORS.light.b)
      pdf.rect(M.L, y - 1, innerW, 6, 'F')
    }

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b)
    pdf.text(item.label, M.L + 3, y + 2)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b)
    pdf.text(item.value, M.L + innerW - 3, y + 2, { align: 'right' })
    y += 6
  })

  y += 8

  // Net pay box
  const netW = 100
  const netX = M.L + innerW - netW
  pdf.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b)
  pdf.roundedRect(netX, y, netW, 24, 2, 2, 'F')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(255, 255, 255)
  pdf.text('NET PAY', netX + 4, y + 6)

  pdf.setFontSize(18)
  pdf.text(`LKR ${data.netLkr.toFixed(2)}`, netX + netW - 4, y + 16, { align: 'right' })

  y += 30

  addVizulabsFooter(
    pdf,
    'Confidential payroll document. Verify figures against attendance records.',
  )

  const safeId = data.employeeId.replace(/[^a-zA-Z0-9-_]/g, '_')
  pdf.save(`salary-slip-${safeId}-${data.periodYm}.pdf`)
}