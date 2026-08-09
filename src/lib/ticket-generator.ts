import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { format } from 'date-fns';

interface TicketData {
  ticketId: string;
  eventName: string;
  eventDate: Date;
  eventLocation: string;
  userName: string;
  userEmail: string;
  attendees: number;
  pricePaid: number;
}

export async function generateTicketPDF(data: TicketData): Promise<Buffer> {
  // Generate QR Code as base64
  const qrCodeDataUrl = await QRCode.toDataURL(data.ticketId, {
    margin: 1,
    width: 200,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4',
      margin: 0 // We'll manage margins manually for the ticket design
    });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // --- Background / Decoration ---
    doc.rect(0, 0, 595.28, 841.89).fill('#ffffff'); // Background
    
    // Header Banner
    doc.rect(0, 0, 595.28, 120).fill('#e11d48'); // Primary Red
    
    doc
      .fillColor('#ffffff')
      .fontSize(28)
      .font('Helvetica-Bold')
      .text('ENTRY TICKET', 40, 45)
      .fontSize(10)
      .font('Helvetica')
      .text('KERALA SAMAJAM AUGSBURG e.V.', 40, 80);

    doc
      .fillColor('#ffffff')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(`#${data.ticketId}`, 450, 55, { align: 'right', width: 100 });

    // --- Event Details Section ---
    const contentY = 160;
    
    doc
      .fillColor('#000000')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(data.eventName, 40, contentY);

    doc.moveDown(0.5);
    
    // Details Grid
    const gridY = contentY + 60;
    
    // Left Column
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text('DATE & TIME', 40, gridY)
      .fillColor('#000000')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(format(data.eventDate, 'EEEE, dd MMMM yyyy'), 40, gridY + 15)
      .text(format(data.eventDate, 'HH:mm'), 40, gridY + 30);

    doc
      .fontSize(10)
      .fillColor('#666666')
      .text('LOCATION', 40, gridY + 70)
      .fillColor('#000000')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(data.eventLocation, 40, gridY + 85, { width: 250 });

    // Right Column
    const rightColX = 350;
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text('ATTENDEE', rightColX, gridY)
      .fillColor('#000000')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(data.userName, rightColX, gridY + 15)
      .font('Helvetica')
      .fontSize(10)
      .text(data.userEmail, rightColX, gridY + 30);

    doc
      .fontSize(10)
      .fillColor('#666666')
      .text('QUANTITY', rightColX, gridY + 70)
      .fillColor('#000000')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(`${data.attendees} Person(s)`, rightColX, gridY + 85);

    // --- QR Code Section ---
    const qrY = 400;
    doc.rect(40, qrY, 515, 220).dash(5, { space: 10 }).stroke('#cccccc');
    
    // Add QR Image
    // qrCodeDataUrl is "data:image/png;base64,..."
    const qrBase64 = qrCodeDataUrl.split(',')[1];
    doc.image(Buffer.from(qrBase64, 'base64'), 200, qrY + 10, { width: 180 });

    doc
      .fillColor('#666666')
      .fontSize(9)
      .font('Helvetica')
      .text('Please present this QR code at the entrance for check-in.', 40, qrY + 195, { align: 'center', width: 515 });

    // --- Footer / Terms ---
    const footerY = 680;
    doc
      .fillColor('#000000')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('TERMS & CONDITIONS', 40, footerY);

    const terms = [
      '• This ticket is valid for one-time entry only.',
      '• Please arrive at least 15 minutes before the event start time.',
      '• Digital or printed copy of this ticket must be presented at the venue.',
      '• Tickets are non-refundable unless the event is cancelled by the organizers.',
      '• Rights of admission reserved by Kerala Samajam Augsburg e.V.'
    ];

    doc.fontSize(9).font('Helvetica').fillColor('#444444');
    terms.forEach((term, index) => {
      doc.text(term, 40, footerY + 25 + (index * 15));
    });

    // Branding at the bottom
    doc.rect(0, 810, 595.28, 32).fill('#f8f9fa');
    doc
      .fillColor('#999999')
      .fontSize(8)
      .text('www.ksaugsburg.de | Kerala Samajam Augsburg e.V. | Registered in Augsburg, Germany', 0, 822, { align: 'center', width: 595.28 });

    doc.end();
  });
}
