import PDFDocument from 'pdfkit';
import { format } from 'date-fns';

interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  dueDate: Date;
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
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header: KSA Logo / Info
    doc
      .fillColor('#444444')
      .fontSize(20)
      .text('KERALA SAMAJAM AUGSBURG e.V.', 50, 50)
      .fontSize(10)
      .text('Am Rathausplatz 1', 50, 80)
      .text('86150 Augsburg, Germany', 50, 95)
      .text('info@ksaugsburg.de', 50, 110)
      .moveDown();

    // Invoice Header
    doc
      .fillColor('#000000')
      .fontSize(24)
      .text('INVOICE', 50, 160, { align: 'right' });

    doc
      .fontSize(10)
      .text(`Invoice Number: ${data.invoiceNumber}`, 50, 190, { align: 'right' })
      .text(`Date: ${format(data.date, 'dd.MM.yyyy')}`, 50, 205, { align: 'right' })
      .text(`Due Date: ${format(data.dueDate, 'dd.MM.yyyy')}`, 50, 220, { align: 'right' })
      .moveDown();

    // Member Info
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

    // Table Header
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

    // Table Content
    const itemTop = tableTop + 30;
    doc
      .fontSize(10)
      .text(`${data.plan.name} Membership Fee`, 50, itemTop)
      .text(`€${data.plan.price.toFixed(2)}`, 400, itemTop, { align: 'right' })
      .text('1', 450, itemTop, { align: 'right' })
      .text(`€${data.plan.price.toFixed(2)}`, 500, itemTop, { align: 'right' });

    // Footer Table
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

    // Notes
    doc
      .font('Helvetica')
      .fontSize(10)
      .text('Payment Status: PAID', 50, totalTop + 100)
      .text(`Payment Method: ${data.paymentMethod}`, 50, totalTop + 115)
      .moveDown();

    doc
      .fontSize(8)
      .fillColor('#888888')
      .text('Kerala Samajam Augsburg e.V. is a registered non-profit association in Germany.', 50, 700, { align: 'center' })
      .text('Membership fees are tax-deductible under § 10b EStG.', 50, 715, { align: 'center' });

    doc.end();
  });
}
