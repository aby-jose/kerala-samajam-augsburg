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
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const isPaid = data.status === 'PAID';

    // Header: association details
    doc
      .fillColor('#444444')
      .fontSize(20)
      .text(data.issuer.name.toUpperCase(), 50, 50)
      .fontSize(10)
      .text(data.issuer.street, 50, 80)
      .text(`${data.issuer.postalCode} ${data.issuer.city}`, 50, 95)
      .text(data.issuer.email, 50, 110)
      .moveDown();

    // Document title — a receipt is not an invoice and should not claim to be
    doc
      .fillColor('#000000')
      .fontSize(24)
      .text(isPaid ? 'RECEIPT' : 'INVOICE', 50, 160, { align: 'right' });

    doc
      .fontSize(10)
      .text(`${isPaid ? 'Receipt' : 'Invoice'} Number: ${data.invoiceNumber}`, 50, 190, { align: 'right' })
      .text(`Date: ${format(data.date, 'dd.MM.yyyy')}`, 50, 205, { align: 'right' })
      .text(
        isPaid && data.paidOn
          ? `Paid On: ${format(data.paidOn, 'dd.MM.yyyy')}`
          : `Due Date: ${format(data.dueDate, 'dd.MM.yyyy')}`,
        50,
        220,
        { align: 'right' }
      )
      .moveDown();

    // Member
    doc
      .fillColor('#444444')
      .fontSize(12)
      .text('Billed To:', 50, 190)
      .fillColor('#000000')
      .fontSize(10)
      .text(data.member.name, 50, 210)
      .text(data.member.address || '', 50, 225)
      .text(`${data.member.zip || ''} ${data.member.city || ''}`, 50, 240)
      .text(data.member.email, 50, 255)
      .moveDown();

    // Line items
    const tableTop = 320;
    doc
      .fontSize(10)
      .text('Description', 50, tableTop)
      .text('Price', 400, tableTop, { align: 'right' })
      .text('Quantity', 450, tableTop, { align: 'right' })
      .text('Total', 500, tableTop, { align: 'right' });

    doc
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    const itemTop = tableTop + 30;
    doc
      .fontSize(10)
      .text(`${data.plan.name} Membership Fee`, 50, itemTop)
      .text(`€${data.plan.price.toFixed(2)}`, 400, itemTop, { align: 'right' })
      .text('1', 450, itemTop, { align: 'right' })
      .text(`€${data.plan.price.toFixed(2)}`, 500, itemTop, { align: 'right' });

    const totalTop = itemTop + 50;
    doc
      .fontSize(10)
      .text('Subtotal:', 400, totalTop, { align: 'right' })
      .text(`€${data.plan.price.toFixed(2)}`, 500, totalTop, { align: 'right' })
      .text('Tax (0%):', 400, totalTop + 15, { align: 'right' })
      .text('€0.00', 500, totalTop + 15, { align: 'right' })
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Total Amount:', 400, totalTop + 40, { align: 'right' })
      .text(`€${data.plan.price.toFixed(2)}`, 500, totalTop + 40, { align: 'right' });

    // Payment block
    let y = totalTop + 100;
    doc.font('Helvetica').fontSize(10).fillColor('#000000');

    if (isPaid) {
      doc.text('Payment Status: PAID', 50, y);
      y += 15;
      doc.text(`Payment Method: ${formatMethod(data.paymentMethod)}`, 50, y);
      y += 15;
      if (data.paidOn) {
        doc.text(`Received On: ${format(data.paidOn, 'dd.MM.yyyy')}`, 50, y);
        y += 15;
      }
      if (data.paymentReference) {
        doc.text(`Reference: ${data.paymentReference}`, 50, y);
        y += 15;
      }
      doc
        .fontSize(9)
        .fillColor('#444444')
        .text('Thank you. Your membership term runs from the date of receipt shown above.', 50, y + 5);
    } else {
      doc
        .font('Helvetica-Bold')
        .text('Payment Status: DUE', 50, y);
      y += 20;

      doc.font('Helvetica').text(`Please transfer €${data.plan.price.toFixed(2)} by ${format(data.dueDate, 'dd.MM.yyyy')} to:`, 50, y);
      y += 18;

      const line = (label: string, value?: string) => {
        if (!value) return;
        doc.text(`${label}: ${value}`, 60, y);
        y += 14;
      };

      line('Account Holder', data.bank?.accountHolder);
      line('Bank', data.bank?.bankName);
      line('IBAN', data.bank?.iban);
      line('BIC', data.bank?.bic);
      line('Reference', data.paymentReference);

      doc
        .fontSize(9)
        .fillColor('#444444')
        .text(
          'Please quote the reference exactly — it is how we match your transfer to your membership. ' +
            'Your membership begins on the day we record your payment, and you will receive a receipt confirming the dates.',
          50,
          y + 6,
          { width: 500 }
        );
    }

    doc
      .fontSize(8)
      .fillColor('#888888')
      .text(`${data.issuer.name} is a registered non-profit association in Germany.`, 50, 700, { align: 'center' })
      .text('Membership fees are tax-deductible under § 10b EStG.', 50, 715, { align: 'center' });

    doc.end();
  });
}

function formatMethod(method: string): string {
  if (method === 'BANK_TRANSFER') return 'Bank transfer';
  if (method === 'CASH') return 'Cash';
  return method;
}
