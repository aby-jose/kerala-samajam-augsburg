import PDFDocument from 'pdfkit';
import { format } from 'date-fns';

/**
 * Membership invoices, in two states.
 *
 * With no payment gateway a member gets the document *before* they pay, so the
 * same generator has to produce a payable invoice carrying the bank details
 * and a reference, and later a receipt confirming the money arrived. It used
 * to print "Payment Status: PAID" unconditionally, which was only ever true
 * because Stripe had already taken the money by the time it ran.
 */
export type InvoiceStatus = 'DUE' | 'PAID';

interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  dueDate: Date;
  status: InvoiceStatus;
  primaryColor?: string;
  /** Set when `status` is PAID: the day the money actually arrived. */
  paidOn?: Date;
  /** The association's own details, from site config rather than hard-coded. */
  issuer: {
    name: string;
    street: string;
    postalCode: string;
    city: string;
    email: string;
  };
  member: {
    name: string;
    email: string;
    address?: string;
    city?: string;
    zip?: string;
  };
  plan: {
    name: string;
    price: number;
    duration: string;
  };
  paymentMethod: string;
  /** Quoted on a transfer so an administrator can match it to this row. */
  paymentReference?: string;
  bank?: {
    accountHolder?: string;
    bankName?: string;
    iban?: string;
    bic?: string;
  };
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const isPaid = data.status === 'PAID';

    // Theme Color Constants
    const COLOR_PRIMARY = '#0f172a';    // Slate 900
    const COLOR_ACCENT = data.primaryColor || '#1e40af';     // Brand Primary Color (set from admin config)
    const COLOR_TEXT = '#334155';       // Slate 700
    const COLOR_MUTED = '#64748b';      // Slate 500
    const COLOR_LIGHT = '#f8fafc';      // Slate 50
    const COLOR_BORDER = '#e2e8f0';     // Slate 200
    
    // Status colors
    const COLOR_SUCCESS = '#0f766e';    // Teal 700
    const COLOR_SUCCESS_BG = '#f0fdfa'; // Teal 50
    const COLOR_SUCCESS_BORDER = '#ccfbf1';

    // Top Indigo decorative bar
    doc.rect(50, 35, 495, 4).fill(COLOR_ACCENT);

    // Header: Association Details (Left)
    doc
      .fillColor(COLOR_PRIMARY)
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(data.issuer.name, 50, 60)
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLOR_TEXT)
      .text(data.issuer.street, 50, 82)
      .text(`${data.issuer.postalCode} ${data.issuer.city}`, 50, 96)
      .text(data.issuer.email, 50, 110);

    // Document Title & Metadata (Right)
    doc
      .fillColor(COLOR_PRIMARY)
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(isPaid ? 'RECEIPT' : 'INVOICE', 300, 60, { width: 245, align: 'right' })
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLOR_MUTED)
      .text(`${isPaid ? 'Receipt' : 'Invoice'} No:`, 300, 88, { width: 140, align: 'right' })
      .font('Helvetica-Bold')
      .fillColor(COLOR_PRIMARY)
      .text(data.invoiceNumber, 445, 88, { width: 100, align: 'right' })
      
      .font('Helvetica')
      .fillColor(COLOR_MUTED)
      .text('Date:', 300, 102, { width: 140, align: 'right' })
      .font('Helvetica-Bold')
      .fillColor(COLOR_PRIMARY)
      .text(format(data.date, 'dd.MM.yyyy'), 445, 102, { width: 100, align: 'right' })
      
      .font('Helvetica')
      .fillColor(COLOR_MUTED)
      .text(isPaid ? 'Paid On:' : 'Due Date:', 300, 116, { width: 140, align: 'right' })
      .font('Helvetica-Bold')
      .fillColor(isPaid ? COLOR_SUCCESS : COLOR_ACCENT)
      .text(
        format(isPaid && data.paidOn ? data.paidOn : data.dueDate, 'dd.MM.yyyy'),
        445,
        116,
        { width: 100, align: 'right' }
      );

    // Horizontal divider
    doc
      .moveTo(50, 140)
      .lineTo(545, 140)
      .strokeColor(COLOR_BORDER)
      .lineWidth(1)
      .stroke();

    // Bill To & Payment Summary Details Grid (Side by side)
    const gridY = 155;
    
    // Left: Billed To
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COLOR_MUTED)
      .text('BILLED TO', 50, gridY)
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLOR_PRIMARY)
      .text(data.member.name, 50, gridY + 16)
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLOR_TEXT)
      .text(data.member.address || '', 50, gridY + 32)
      .text(`${data.member.zip || ''} ${data.member.city || ''}`, 50, 46 + gridY)
      .text(data.member.email, 50, 60 + gridY);

    // Right: Payment Details Summary
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COLOR_MUTED)
      .text('PAYMENT METHOD', 330, gridY)
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(COLOR_PRIMARY)
      .text(formatMethod(data.paymentMethod), 330, gridY + 16);

    if (data.paymentReference) {
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COLOR_MUTED)
        .text('PAYMENT REFERENCE', 330, gridY + 38)
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(COLOR_ACCENT)
        .text(data.paymentReference, 330, gridY + 54);
    }

    // Line items table
    const tableTop = 245;
    
    // Header background bar
    doc
      .rect(50, tableTop, 495, 20)
      .fill(COLOR_LIGHT);

    // Header labels
    doc
      .fillColor(COLOR_MUTED)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text('DESCRIPTION', 60, tableTop + 6)
      .text('PRICE', 330, tableTop + 6, { width: 60, align: 'right' })
      .text('QTY', 410, tableTop + 6, { width: 40, align: 'right' })
      .text('TOTAL', 475, tableTop + 6, { width: 60, align: 'right' });

    // Item row
    const itemTop = tableTop + 28;
    doc
      .fillColor(COLOR_PRIMARY)
      .font('Helvetica')
      .fontSize(9.5)
      .text(`${data.plan.name} Membership Fee`, 60, itemTop)
      .text(`€${data.plan.price.toFixed(2)}`, 330, itemTop, { width: 60, align: 'right' })
      .text('1', 410, itemTop, { width: 40, align: 'right' })
      .font('Helvetica-Bold')
      .text(`€${data.plan.price.toFixed(2)}`, 475, itemTop, { width: 60, align: 'right' });

    // Row separator line
    doc
      .moveTo(50, itemTop + 18)
      .lineTo(545, itemTop + 18)
      .strokeColor(COLOR_BORDER)
      .lineWidth(0.5)
      .stroke();

    // Summary calculations block (Subtotal, Tax, Total)
    const totalsTop = itemTop + 28;
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(COLOR_MUTED)
      .text('Subtotal:', 350, totalsTop, { width: 110, align: 'right' })
      .fillColor(COLOR_TEXT)
      .text(`€${data.plan.price.toFixed(2)}`, 475, totalsTop, { width: 60, align: 'right' })
      
      .fillColor(COLOR_MUTED)
      .text('Tax (0%):', 350, totalsTop + 14, { width: 110, align: 'right' })
      .fillColor(COLOR_TEXT)
      .text('€0.00', 475, totalsTop + 14, { width: 60, align: 'right' });

    // Total Amount highlight row
    doc
      .rect(340, totalsTop + 30, 205, 24)
      .fill(COLOR_LIGHT);
      
    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor(COLOR_PRIMARY)
      .text('Total Amount:', 350, totalsTop + 37, { width: 110, align: 'right' })
      .fontSize(10.5)
      .fillColor(COLOR_ACCENT)
      .text(`€${data.plan.price.toFixed(2)}`, 475, totalsTop + 36, { width: 60, align: 'right' });

    // Status Cards & Payment Instructions Card
    const cardY = totalsTop + 75;

    if (isPaid) {
      // Success paid card
      doc
        .roundedRect(50, cardY, 495, 78, 4)
        .fillAndStroke(COLOR_SUCCESS_BG, COLOR_SUCCESS_BORDER);

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(COLOR_SUCCESS)
        .text('Payment Status: PAID', 65, cardY + 12)
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(COLOR_TEXT)
        .text(`Payment Method: ${formatMethod(data.paymentMethod)}`, 65, cardY + 28)
        .text(
          data.paidOn ? `Received On: ${format(data.paidOn, 'dd.MM.yyyy')}` : '',
          65,
          cardY + 41
        )
        .text(
          data.paymentReference ? `Payment Reference: ${data.paymentReference}` : '',
          65,
          cardY + 54
        );

      doc
        .fontSize(8.5)
        .fillColor(COLOR_MUTED)
        .text(
          'Thank you. Your membership term runs from the date of receipt shown above.',
          50,
          cardY + 92,
          { width: 495 }
        );
    } else {
      // Due bank transfer instructions card
      doc
        .roundedRect(50, cardY, 495, 115, 4)
        .fillAndStroke(COLOR_LIGHT, COLOR_BORDER);

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(COLOR_PRIMARY)
        .text('Bank Transfer Instructions', 65, cardY + 12)
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(COLOR_TEXT)
        .text(
          `Please transfer €${data.plan.price.toFixed(2)} by ${format(
            data.dueDate,
            'dd.MM.yyyy'
          )} to:`,
          65,
          cardY + 26
        );

      // Bank account details table inside card
      const detailY = cardY + 44;
      doc
        .font('Helvetica-Bold')
        .fillColor(COLOR_MUTED)
        .text('Account Holder:', 65, detailY)
        .fillColor(COLOR_PRIMARY)
        .text(data.bank?.accountHolder || '', 150, detailY)
        
        .fillColor(COLOR_MUTED)
        .text('Bank Name:', 65, detailY + 14)
        .fillColor(COLOR_PRIMARY)
        .text(data.bank?.bankName || '', 150, detailY + 14)

        .fillColor(COLOR_MUTED)
        .text('IBAN:', 65, detailY + 28)
        .fillColor(COLOR_PRIMARY)
        .text(data.bank?.iban || '', 150, detailY + 28)

        .fillColor(COLOR_MUTED)
        .text('BIC:', 65, detailY + 42)
        .fillColor(COLOR_PRIMARY)
        .text(data.bank?.bic || '', 150, detailY + 42)

        .fillColor(COLOR_MUTED)
        .text('Reference:', 65, detailY + 56)
        .font('Helvetica-Bold')
        .fillColor(COLOR_ACCENT)
        .text(data.paymentReference || '', 150, detailY + 56);

      // Warning text below card
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLOR_MUTED)
        .text(
          'Please quote the reference exactly — it is how we match your transfer to your membership. ' +
            'Your membership begins on the day we record your payment, and you will receive a receipt confirming the dates.',
          50,
          cardY + 128,
          { width: 495, align: 'justify' }
        );
    }

    // Professional Footer centered at the bottom
    doc
      .moveTo(50, 715)
      .lineTo(545, 715)
      .strokeColor(COLOR_BORDER)
      .lineWidth(0.5)
      .stroke();

    doc
      .fontSize(7.5)
      .fillColor(COLOR_MUTED)
      .text(
        `${data.issuer.name} is a registered non-profit association in Germany.`,
        50,
        725,
        { align: 'center', width: 495 }
      )
      .text('Membership fees are tax-deductible under § 10b EStG.', 50, 736, {
        align: 'center',
        width: 495,
      });

    doc.end();
  });
}

function formatMethod(method: string): string {
  if (method === 'BANK_TRANSFER') return 'Bank transfer';
  if (method === 'CASH') return 'Cash';
  return method;
}
