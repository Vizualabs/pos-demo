import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { CustomerInvoice } from '@/lib/invoicesApi'
import type { CustomerMealInvoiceResponseDto } from '@/lib/customerMealInvoicesApi'
import { formatCurrency } from '@/lib/utils'

export type GeneratePdfOptions = {
  /**
   * Invoice slips are often `position:fixed; left:-9999px` so they don’t flash on screen.
   * html2canvas can capture an empty or wrong frame unless the clone is moved on-screen in the clone document.
   */
  fixOffscreenClone?: boolean
  /** Side margins on A4 (mm). Default 10. */
  marginMm?: number
  /** Hide elements with class `pdf-hide` in the clone (buttons, toolbars). Default true. */
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
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

/** Customer invoice as a native vector PDF (no html2canvas). */
export function generateCustomerInvoicePdf(invoice: CustomerInvoice): void {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const W = 210
  const M = { L: 16, R: 16, T: 14 }
  const innerW = W - M.L - M.R
  let y = M.T
  const isPaid = invoice.status === 'paid'
  const bottomSafe = 278

  const newPageIfNeeded = (needMm: number) => {
    if (y + needMm > bottomSafe) {
      pdf.addPage()
      y = M.T
    }
  }

  // Top accent bar
  pdf.setFillColor(2, 132, 199)
  pdf.rect(M.L, y, innerW, 1.5, 'F')
  y += 8

  pdf.setTextColor(100, 116, 139)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.text('TAX INVOICE', M.L, y)
  y += 4.5

  pdf.setTextColor(15, 23, 42)
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Invoice', M.L, y)
  pdf.setFont('courier', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(100, 116, 139)
  pdf.text(invoice.invoiceId, M.L + innerW, y, { align: 'right' })
  y += 6

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(15, 23, 42)
  pdf.text('Your business name', M.L + innerW, y, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(100, 116, 139)
  y += 4
  pdf.text('Catering & restaurant services', M.L + innerW, y, { align: 'right' })
  y += 3.5
  pdf.text('Sri Lanka', M.L + innerW, y, { align: 'right' })
  y += 10

  const wBill = innerW * 0.56
  const wDate = innerW - wBill - 3
  const xDate = M.L + wBill + 3

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(15, 23, 42)
  const custLines = pdf.splitTextToSize(invoice.customerName, wBill - 6)
  pdf.setFontSize(8)
  const dateStr = formatInvoiceDatePdf(invoice.createdAt)
  const dateLines = pdf.splitTextToSize(dateStr, wDate - 4)
  const boxH = Math.max(20, 9 + custLines.length * 4.8, 9 + dateLines.length * 4.2)

  pdf.setFillColor(241, 245, 249)
  pdf.setDrawColor(226, 232, 240)
  pdf.rect(M.L, y, wBill, boxH, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(100, 116, 139)
  pdf.text('BILL TO', M.L + 3, y + 4.5)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(15, 23, 42)
  pdf.text(custLines, M.L + 3, y + 9)

  pdf.setFillColor(255, 255, 255)
  pdf.rect(xDate, y, wDate, boxH, 'FD')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(100, 116, 139)
  pdf.text('ISSUE DATE', xDate + 2, y + 4.5)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(15, 23, 42)
  pdf.text(dateLines, xDate + 2, y + 9)

  y += boxH + 6

  newPageIfNeeded(14)
  if (isPaid) {
    pdf.setFillColor(220, 252, 231)
    pdf.setDrawColor(167, 243, 208)
    pdf.setTextColor(22, 101, 52)
  } else {
    pdf.setFillColor(254, 243, 199)
    pdf.setDrawColor(253, 224, 71)
    pdf.setTextColor(120, 53, 15)
  }
  const statusText = isPaid ? 'Paid' : 'Pending payment'
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  const pillW = pdf.getTextWidth(statusText) + 8
  pdf.roundedRect(M.L, y, pillW, 6.5, 1.2, 1.2, 'FD')
  pdf.text(statusText, M.L + 4, y + 4.5)
  pdf.setTextColor(15, 23, 42)
  y += 11

  newPageIfNeeded(16)
  pdf.setFillColor(241, 245, 249)
  pdf.setDrawColor(226, 232, 240)
  const headH = 8
  pdf.rect(M.L, y, innerW, headH, 'FD')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(100, 116, 139)
  const colQty = M.L + innerW - 62
  const colUnit = M.L + innerW - 42
  const colRight = M.L + innerW - 3
  pdf.text('DESCRIPTION', M.L + 2, y + 5.2)
  pdf.text('QTY', colQty, y + 5.2)
  pdf.text('UNIT PRICE', colUnit, y + 5.2)
  pdf.text('AMOUNT', colRight, y + 5.2, { align: 'right' })
  y += headH

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(15, 23, 42)
  const descMaxW = innerW - 68

  for (const line of invoice.lines) {
    const descParts = pdf.splitTextToSize(line.description, descMaxW)
    const lineBlockH = Math.max(8, descParts.length * 4.6 + 3)
    newPageIfNeeded(lineBlockH + 2)

    pdf.setDrawColor(241, 245, 249)
    pdf.line(M.L, y + lineBlockH, M.L + innerW, y + lineBlockH)

    pdf.text(descParts, M.L + 2, y + 5)
    pdf.text(String(line.qty), colQty, y + 5)
    pdf.text(formatCurrency(line.unitPrice), colUnit, y + 5)
    pdf.text(formatCurrency(line.lineTotal), colRight, y + 5, { align: 'right' })
    y += lineBlockH
  }

  y += 5
  newPageIfNeeded(32)
  const totalW = 78
  const totalX = M.L + innerW - totalW
  pdf.setFillColor(224, 242, 254)
  pdf.setDrawColor(186, 230, 253)
  pdf.roundedRect(totalX, y, totalW, 24, 2, 2, 'FD')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(2, 132, 199)
  pdf.text(isPaid ? 'TOTAL PAID' : 'AMOUNT DUE', totalX + 4, y + 7)
  pdf.setFontSize(14)
  pdf.setTextColor(15, 23, 42)
  pdf.text(formatCurrency(invoice.total), totalX + totalW - 4, y + 17, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.setTextColor(100, 116, 139)
  const note = isPaid ? 'Thank you — payment received.' : 'Please settle by the agreed due date.'
  pdf.text(note, totalX + 4, y + 21)

  y += 30
  newPageIfNeeded(12)
  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.2)
  pdf.line(M.L, y, M.L + innerW, y)
  y += 6
  pdf.setFontSize(7)
  pdf.setTextColor(120, 120, 120)
  pdf.text('Generated for your records.', W / 2, y, { align: 'center' })
  y += 3.5
  pdf.text(`Questions? Quote invoice ${invoice.invoiceId}.`, W / 2, y, { align: 'center' })

  const safeFile = `${invoice.invoiceId.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
  pdf.save(safeFile)
}

/** Customer meal invoice as a native vector PDF (no html2canvas). */
export function generateCustomerMealInvoicePdf(invoice: CustomerMealInvoiceResponseDto): void {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const W = 210
  const M = { L: 16, R: 16, T: 14 }
  const innerW = W - M.L - M.R
  let y = M.T

  const bottomSafe = 278
  const newPageIfNeeded = (needMm: number) => {
    if (y + needMm > bottomSafe) {
      pdf.addPage()
      y = M.T
    }
  }

  const isPaid = invoice.status === 'PAID'
  const invoiceNo = String(invoice.invoiceNo || invoice.invoiceId)

  // Top accent bar
  pdf.setFillColor(2, 132, 199)
  pdf.rect(M.L, y, innerW, 1.5, 'F')
  y += 8

  pdf.setTextColor(100, 116, 139)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.text('CUSTOMER MEAL INVOICE', M.L, y)
  y += 4.5

  pdf.setTextColor(15, 23, 42)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Invoice', M.L, y)
  pdf.setFont('courier', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(100, 116, 139)
  pdf.text(invoiceNo, M.L + innerW, y, { align: 'right' })
  y += 10

  const wLeft = innerW * 0.56
  const wRight = innerW - wLeft - 3
  const xRight = M.L + wLeft + 3

  const cust = String(invoice.customerName ?? '').trim() || 'Customer'
  const dateStr = formatInvoiceDatePdf(invoice.createdAt)
  const paidAtStr = invoice.paidAt ? formatInvoiceDatePdf(invoice.paidAt) : '—'

  const leftLines = pdf.splitTextToSize(cust, wLeft - 6)
  const rightLines = pdf.splitTextToSize(dateStr, wRight - 4)
  const boxH = Math.max(22, 9 + leftLines.length * 4.8, 9 + rightLines.length * 4.2)

  pdf.setFillColor(241, 245, 249)
  pdf.setDrawColor(226, 232, 240)
  pdf.rect(M.L, y, wLeft, boxH, 'FD')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(100, 116, 139)
  pdf.text('CUSTOMER', M.L + 3, y + 4.5)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(15, 23, 42)
  pdf.text(leftLines, M.L + 3, y + 9)

  pdf.setFillColor(255, 255, 255)
  pdf.rect(xRight, y, wRight, boxH, 'FD')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(100, 116, 139)
  pdf.text('ISSUE DATE', xRight + 2, y + 4.5)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(15, 23, 42)
  pdf.text(rightLines, xRight + 2, y + 9)

  y += boxH + 6

  newPageIfNeeded(14)
  if (isPaid) {
    pdf.setFillColor(220, 252, 231)
    pdf.setDrawColor(167, 243, 208)
    pdf.setTextColor(22, 101, 52)
  } else {
    pdf.setFillColor(254, 243, 199)
    pdf.setDrawColor(253, 224, 71)
    pdf.setTextColor(120, 53, 15)
  }
  const statusText = isPaid ? 'PAID' : 'UNPAID'
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  const pillW = pdf.getTextWidth(statusText) + 8
  pdf.roundedRect(M.L, y, pillW, 6.5, 1.2, 1.2, 'FD')
  pdf.text(statusText, M.L + 4, y + 4.5)
  pdf.setTextColor(15, 23, 42)
  y += 11

  newPageIfNeeded(28)
  pdf.setFillColor(241, 245, 249)
  pdf.setDrawColor(226, 232, 240)
  pdf.rect(M.L, y, innerW, 8, 'FD')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(100, 116, 139)
  pdf.text('MEAL TYPE', M.L + 2, y + 5.2)
  pdf.text('QTY', M.L + innerW - 60, y + 5.2)
  pdf.text('UNIT PRICE', M.L + innerW - 40, y + 5.2)
  pdf.text('TOTAL', M.L + innerW - 3, y + 5.2, { align: 'right' })
  y += 8

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(15, 23, 42)
  pdf.text(String(invoice.mealType), M.L + 2, y + 6)
  pdf.text(String(invoice.quantity), M.L + innerW - 60, y + 6)
  pdf.text(formatCurrency(invoice.unitPrice), M.L + innerW - 40, y + 6)
  pdf.text(formatCurrency(invoice.total), M.L + innerW - 3, y + 6, { align: 'right' })
  y += 14

  newPageIfNeeded(24)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(100, 116, 139)
  pdf.text('PAID AT', M.L, y)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(15, 23, 42)
  pdf.text(paidAtStr, M.L + 22, y)
  y += 10

  pdf.setFontSize(7)
  pdf.setTextColor(120, 120, 120)
  pdf.text(`Generated for invoice ${invoiceNo}.`, W / 2, 285, { align: 'center' })

  const safeFile = `${invoiceNo.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
  pdf.save(safeFile)
}

export const generateSalesReport = (data: any[]) => {
  const pdf = new jsPDF()
  
  // Header
  pdf.setFontSize(20)
  pdf.text('Sales Report', 20, 20)
  
  pdf.setFontSize(12)
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 30)
  
  // Table headers
  pdf.setFontSize(10)
  pdf.text('Item', 20, 50)
  pdf.text('Quantity', 80, 50)
  pdf.text('Price', 120, 50)
  pdf.text('Total', 160, 50)
  
  // Table data
  let yPosition = 60
  data.forEach((item, index) => {
    if (yPosition > 280) {
      pdf.addPage()
      yPosition = 20
    }
    
    pdf.text(item.name || 'Item', 20, yPosition)
    pdf.text(item.quantity?.toString() || '0', 80, yPosition)
    pdf.text(`$${item.price || 0}`, 120, yPosition)
    pdf.text(`$${(item.quantity || 0) * (item.price || 0)}`, 160, yPosition)
    yPosition += 10
  })
  
  pdf.save('sales-report.pdf')
}

export const generateInventoryReport = (data: any[]) => {
  const pdf = new jsPDF()
  
  // Header
  pdf.setFontSize(20)
  pdf.text('Inventory Report', 20, 20)
  
  pdf.setFontSize(12)
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 30)
  
  // Table headers
  pdf.setFontSize(10)
  pdf.text('Item', 20, 50)
  pdf.text('Category', 80, 50)
  pdf.text('Stock', 120, 50)
  pdf.text('Price', 160, 50)
  
  // Table data
  let yPosition = 60
  data.forEach((item, index) => {
    if (yPosition > 280) {
      pdf.addPage()
      yPosition = 20
    }
    
    pdf.text(item.name || 'Item', 20, yPosition)
    pdf.text(item.category || 'Category', 80, yPosition)
    pdf.text(item.stock?.toString() || '0', 120, yPosition)
    pdf.text(`$${item.price || 0}`, 160, yPosition)
    yPosition += 10
  })
  
  pdf.save('inventory-report.pdf')
}

export type SalarySlipPdfInput = {
  employeeName: string
  employeeId: string
  role: string
  /** yyyy-mm */
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

/** Simple text-based salary slip (loan/advance deduction + net pay). */
export function generateSalarySlipPdf(data: SalarySlipPdfInput): void {
  const pdf = new jsPDF("p", "mm", "a4")
  let y = 18

  const periodHuman =
    data.periodYm.length >= 7
      ? new Date(`${data.periodYm}-01T12:00:00`).toLocaleString(undefined, { month: "long", year: "numeric" })
      : data.periodYm

  pdf.setFontSize(18)
  pdf.setFont("helvetica", "bold")
  pdf.text("Salary slip", 20, y)
  y += 12

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(100, 100, 100)
  pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, y)
  pdf.setTextColor(0, 0, 0)
  y += 14

  const row = (label: string, value: string) => {
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.text(label, 20, y)
    pdf.setFont("helvetica", "normal")
    const wrapped = pdf.splitTextToSize(value, 115)
    pdf.text(wrapped, 72, y)
    y += Math.max(8, wrapped.length * 5 + 2)
  }

  row("Employee", data.employeeName)
  row("Employee ID", data.employeeId)
  row("Role", data.role)
  row("Pay period", periodHuman)
  row("Payment per day", `LKR ${data.paymentPerDay.toFixed(2)}`)
  row("Present days", String(data.present))
  row("Leave days", String(data.leave))
  row("Absent days", String(data.absent))
  row("Paid leave (capped)", String(data.paidLeaveDays))
  row("Unpaid leave", String(data.unpaidLeaveDays))
  row("Total paid days", String(data.paidDays))
  row("Gross pay", `LKR ${data.grossLkr.toFixed(2)}`)
  row("Loan / advance deduction", `LKR ${data.deductionLkr.toFixed(2)}`)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(12)
  pdf.text("Net pay", 20, y)
  pdf.setFont("helvetica", "normal")
  pdf.text(`LKR ${data.netLkr.toFixed(2)}`, 72, y)
  y += 14

  pdf.setFontSize(9)
  pdf.setTextColor(90, 90, 90)
  pdf.text("Demo payroll document — verify figures against attendance records.", 20, 285)

  const safeId = data.employeeId.replace(/[^a-zA-Z0-9-_]/g, "_")
  pdf.save(`salary-slip-${safeId}-${data.periodYm}.pdf`)
}
