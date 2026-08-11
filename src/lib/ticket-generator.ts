import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { format } from 'date-fns';

import { getConfig } from './config-utils';

interface TicketData {
  ticketId: string;
  eventName: string;
  eventDate: Date;
  eventLocation: string;
  userName: string;
  userEmail: string;
  attendees: number;
  pricePaid: number;
  /**
   * Still owed at the door. Tickets are issued before payment now — there is
   * no gateway to take the money up front — so the ticket has to say whether
   * it is settled, and the check-in desk collects what is outstanding.
   */
  amountDue?: number;
}

// --- Sheet geometry --------------------------------------------------------
// A ticket, not a letter. The page itself is the ticket: one compact landscape
// card that reads at a glance on a phone at the door, with a tear-off stub on
// the right carrying the QR. An A4 sheet with a banner across the top was
// mostly empty paper and looked like an invoice.
const W = 680;
const H = 260;
const RAIL_W = 34; // brand spine down the left edge
const STUB_W = 180;
const PERF_X = W - STUB_W; // the tear line
const PAD = 22;
const BODY_X = RAIL_W + PAD;
const BODY_W = PERF_X - PAD - BODY_X;

// The stub is a card inset from the page, not a panel bleeding off the top,
// bottom and right edges. Nothing on it — tint or price block — reaches an
// edge; the margin is what makes it read as something you tear off and keep.
const STUB_GAP = 18;
const CARD_X = PERF_X + STUB_GAP;
const CARD_Y = STUB_GAP;
const CARD_W = W - CARD_X - STUB_GAP;
const CARD_H = H - STUB_GAP * 2;
const CARD_R = 10;

// The QR sits on its own white card. The card is the quiet zone: scanners need
// clear space around the code, and the stub is tinted, so the code cannot just
// sit on the background.
const QR_CARD = 100;
const QR_PAD = 11;
const QR_SIZE = QR_CARD - QR_PAD * 2;

// Neutrals. Everything with any colour in it comes from site branding instead.
const PAPER = '#ffffff';
const INK = '#14141c';
const MUTED = '#6b7280';

// Used when an administrator has cleared the colour or typed something that
// is not a hex value; matches `defaultConfig.branding`.
const FALLBACK_PRIMARY = '#e11d48';

export async function generateTicketPDF(data: TicketData): Promise<Buffer> {
  // Branding is read here rather than passed in, so the emailed ticket and the
  // downloaded one cannot drift apart, and neither caller has to remember to
  // thread the palette through. `getConfig` is request-cached.
  const config = await getConfig();
  const entity = config.legal;

  // Only the primary colour is used. The secondary is a free-form field an
  // administrator rarely touches, so pulling it in as a second hue mostly
  // means printing last year's default indigo next to this year's brand.
  const brand = normalizeHex(config.branding.primaryColor, FALLBACK_PRIMARY);
  const brandInk = readableOn(brand);
  const stubTint = tint(brand, 0.93);
  const stubEdge = tint(brand, 0.55);

  // Black on white, deliberately not brand-tinted: this is the one part of the
  // ticket a machine has to read, in whatever light the foyer happens to have.
  const qrCodeDataUrl = await QRCode.toDataURL(data.ticketId, {
    margin: 1,
    width: 400,
    color: {
      dark: '#000000',
      light: PAPER,
    },
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [W, H],
      margin: 0,
      info: {
        Title: `Entry ticket ${data.ticketId}`,
        Author: entity.entityName,
      },
    });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const dueAmount = data.amountDue ?? 0;
    const isDue = dueAmount > 0;
    const isFree = !isDue && data.pricePaid <= 0;

    // --- Card ------------------------------------------------------------
    doc.rect(0, 0, W, H).fill(PAPER);

    // Brand spine, with the ticket's name set vertically along it the way a
    // cinema stub carries its title down the side.
    doc.rect(0, 0, RAIL_W, H).fill(brand);
    doc.save();
    doc.rotate(-90, { origin: [RAIL_W / 2, H / 2] });
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(brandInk)
      .text('ENTRY TICKET', RAIL_W / 2 - H / 2, H / 2 - 6, {
        width: H,
        align: 'center',
        characterSpacing: 3.4,
      });
    doc.restore();

    // Stub card, tinted from the brand rather than a flat grey.
    doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, CARD_R).fill(stubTint);

    // --- Body ------------------------------------------------------------
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(entity.entityName.toUpperCase(), BODY_X, 22, {
        width: BODY_W,
        characterSpacing: 1.4,
        lineBreak: false,
      });

    // Payment state reads as a status pill in the header rather than a banner
    // across the card. A volunteer scanning a queue is looking for a dot and a
    // word, not a sentence, and the amount belongs with the other facts below.
    //
    // These stay amber/green rather than taking the brand colour: the pill is
    // what tells the door whether to collect money, so it has to keep meaning
    // that even for an association whose brand happens to be green.
    const status = isDue
      ? { label: 'PAYMENT DUE', bg: '#fff7ed', edge: '#fdba74', fg: '#b45309', dot: '#f59e0b' }
      : { label: isFree ? 'FREE ENTRY' : 'PAID', bg: '#ecfdf5', edge: '#6ee7b7', fg: '#047857', dot: '#10b981' };

    const pillY = 16;
    const pillH = 17;
    doc.font('Helvetica-Bold').fontSize(7.2);
    const labelW = doc.widthOfString(status.label, { characterSpacing: 1.3 });
    const pillW = labelW + 30;
    const pillX = BODY_X + BODY_W - pillW;

    doc.roundedRect(pillX, pillY, pillW, pillH, pillH / 2).fill(status.bg);
    doc
      .roundedRect(pillX + 0.5, pillY + 0.5, pillW - 1, pillH - 1, (pillH - 1) / 2)
      .lineWidth(1)
      .stroke(status.edge);
    doc.circle(pillX + 11, pillY + pillH / 2, 3).fill(status.dot);
    doc
      .font('Helvetica-Bold')
      .fontSize(7.2)
      .fillColor(status.fg)
      .text(status.label, pillX + 18, pillY + 5.6, {
        width: labelW + 4,
        characterSpacing: 1.3,
        lineBreak: false,
      });

    const titleSize = fitFontSize(doc, data.eventName, 'Helvetica-Bold', 24, 13, BODY_W);
    doc
      .font('Helvetica-Bold')
      .fontSize(titleSize)
      .fillColor(INK)
      .text(clip(doc, data.eventName, BODY_W), BODY_X, 36, {
        width: BODY_W,
        lineBreak: false,
      });

    // Short brand rule under the title.
    doc.rect(BODY_X, 70, 44, 3.5).fill(brand);

    // Four facts across, two below. The amount is just another fact in the
    // grid — it does not need its own banner once the pill has said whether
    // the money is outstanding.
    const c1 = BODY_X;
    const c2 = BODY_X + 146;
    const c3 = BODY_X + 206;
    const c4 = BODY_X + 286;
    const rowB = 134;

    field(doc, 'DATE', format(data.eventDate, 'EEEE, dd MMM yyyy'), c1, 92, 140);
    field(doc, 'TIME', format(data.eventDate, 'HH:mm'), c2, 92, 54);
    field(
      doc,
      'ADMITS',
      `${data.attendees} ${data.attendees === 1 ? 'Person' : 'People'}`,
      c3,
      92,
      74
    );
    field(
      doc,
      isDue ? 'AMOUNT DUE' : isFree ? 'ADMISSION' : 'AMOUNT PAID',
      isFree ? 'Free' : `€${(isDue ? dueAmount : data.pricePaid).toFixed(2)}`,
      c4,
      92,
      BODY_X + BODY_W - c4
    );

    field(doc, 'VENUE', data.eventLocation, c1, rowB, 190);

    const holderW = BODY_X + BODY_W - c3;
    field(doc, 'TICKET HOLDER', data.userName, c3, rowB, holderW);
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(clip(doc, data.userEmail, holderW), c3, rowB + 27, {
        width: holderW,
        lineBreak: false,
      });

    // --- Fine print ------------------------------------------------------
    const terms = [
      isDue
        ? `Please have €${dueAmount.toFixed(2)} ready at the door — this ticket admits you either way`
        : 'Valid for one-time entry only',
      'Please arrive 15 minutes before the start time',
      'Show this ticket, printed or on your phone, at the entrance',
      'Non-refundable unless the event is cancelled by the organisers',
      'Rights of admission reserved',
    ].join('  ·  ');

    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor(MUTED)
      .text(terms, BODY_X, 186, { width: BODY_W, lineGap: 2 });

    // Follows the terms rather than sitting at a fixed y: the unpaid variant
    // carries an extra clause and wraps to a third line.
    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor(MUTED)
      .text(`${entity.entityName}  ·  ${config.contactEmail}`, BODY_X, doc.y + 6, {
        width: BODY_W,
        lineBreak: false,
      });

    // --- Stub ------------------------------------------------------------
    doc
      .font('Helvetica-Bold')
      .fontSize(6.6)
      .fillColor(MUTED)
      .text('SCAN AT ENTRY', CARD_X, CARD_Y + 16, {
        width: CARD_W,
        align: 'center',
        characterSpacing: 1.8,
        lineBreak: false,
      });

    const qrX = CARD_X + (CARD_W - QR_CARD) / 2;
    const qrY = CARD_Y + 32;
    doc.roundedRect(qrX, qrY, QR_CARD, QR_CARD, 8).fill(PAPER);

    const qrBase64 = qrCodeDataUrl.split(',')[1];
    doc.image(Buffer.from(qrBase64, 'base64'), qrX + QR_PAD, qrY + QR_PAD, {
      width: QR_SIZE,
      height: QR_SIZE,
    });

    doc
      .font('Helvetica')
      .fontSize(6.4)
      .fillColor(MUTED)
      .text('TICKET NO.', CARD_X, 162, {
        width: CARD_W,
        align: 'center',
        characterSpacing: 1.4,
        lineBreak: false,
      });

    const idSize = fitFontSize(doc, data.ticketId, 'Helvetica-Bold', 12, 7, CARD_W - 30);
    doc
      .font('Helvetica-Bold')
      .fontSize(idSize)
      .fillColor(INK)
      .text(data.ticketId, CARD_X, 173, {
        width: CARD_W,
        align: 'center',
        lineBreak: false,
      });

    // Price block anchored to the foot of the stub card — the one loud use of
    // the brand colour, and the thing a volunteer on the door looks for first.
    // Rounded to the card's bottom corners, then squared off along its top.
    const blockY = 196;
    const blockH = CARD_Y + CARD_H - blockY;
    doc.roundedRect(CARD_X, blockY, CARD_W, blockH, CARD_R).fill(brand);
    doc.rect(CARD_X, blockY, CARD_W, CARD_R).fill(brand);
    doc
      .font('Helvetica')
      .fontSize(6.2)
      .fillColor(brandInk)
      .text(isDue ? 'TO PAY' : isFree ? 'ADMISSION' : 'PAID', CARD_X, blockY + 10, {
        width: CARD_W,
        align: 'center',
        characterSpacing: 1.6,
        lineBreak: false,
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(17)
      .fillColor(brandInk)
      .text(
        isFree ? 'FREE' : `€${(isDue ? dueAmount : data.pricePaid).toFixed(2)}`,
        CARD_X,
        blockY + 21,
        { width: CARD_W, align: 'center', lineBreak: false }
      );

    // --- Perforation -----------------------------------------------------
    // The tear line runs alongside the stub card rather than to the page edge.
    // The punched notches are gone with it: the gap around the card is white
    // on white, so there was nothing left for them to bite into.
    doc
      .moveTo(PERF_X, CARD_Y)
      .lineTo(PERF_X, CARD_Y + CARD_H)
      .lineWidth(1)
      .dash(3, { space: 4 })
      .stroke(stubEdge);
    doc.undash();

    doc.end();
  });
}

/** A label/value pair in the details grid. */
function field(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
) {
  doc
    .font('Helvetica')
    .fontSize(6.4)
    .fillColor(MUTED)
    .text(label, x, y, { width, characterSpacing: 1.2, lineBreak: false });

  const size = fitFontSize(doc, value, 'Helvetica-Bold', 11.5, 8, width);
  doc
    .font('Helvetica-Bold')
    .fontSize(size)
    .fillColor(INK)
    .text(clip(doc, value, width), x, y + 11, { width, lineBreak: false });
}

/**
 * Largest size at or below `max` that keeps `text` on one line, so a long
 * event title or venue shrinks instead of wrapping into the row beneath it.
 */
function fitFontSize(
  doc: PDFKit.PDFDocument,
  text: string,
  font: string,
  max: number,
  min: number,
  width: number
): number {
  doc.font(font);
  let size = max;
  while (size > min && doc.fontSize(size).widthOfString(text) > width) {
    size -= 0.5;
  }
  return size;
}

/** Truncate to `width` at the current font and size. Assumes both are set. */
function clip(doc: PDFKit.PDFDocument, text: string, width: number): string {
  if (doc.widthOfString(text) <= width) return text;
  let out = text;
  while (out.length > 1 && doc.widthOfString(`${out}…`) > width) {
    out = out.slice(0, -1);
  }
  return `${out.trimEnd()}…`;
}

// --- Colour helpers --------------------------------------------------------

/** Accept `#rgb` and `#rrggbb`; anything else falls back to the default. */
function normalizeHex(value: string | undefined, fallback: string): string {
  const hex = (value ?? '').trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase();
  }
  return fallback;
}

function toRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex(rgb: [number, number, number]): string {
  const channel = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${channel(rgb[0])}${channel(rgb[1])}${channel(rgb[2])}`;
}

/** Mix towards white — the stub tint and its edge. */
function tint(hex: string, amount: number): string {
  const [r, g, b] = toRgb(hex);
  return toHex([r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount]);
}

/**
 * Text colour that stays legible on `hex`.
 *
 * The brand colour is whatever an administrator typed into settings, so it can
 * just as easily be pale yellow as rose. Hard-coding white here would make the
 * spine and the price block unreadable; this picks by relative luminance, at
 * the WCAG crossover where dark text starts winning.
 */
function readableOn(hex: string): string {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.18 ? INK : PAPER;
}
