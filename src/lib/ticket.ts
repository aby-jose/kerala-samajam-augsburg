import { customAlphabet } from "nanoid";

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const nanoid = customAlphabet(alphabet, 12);

/**
 * The only place a ticket id is minted.
 *
 * The id is a bearer capability: `/api/tickets/<id>` serves the PDF to whoever
 * presents it, because most registrations are anonymous and have no account to
 * check against. That makes it a secret, so it comes from nanoid's CSPRNG.
 * Registrations created by the old payment webhook built it from
 * `Math.random().toString(36)` instead — not cryptographic, and short enough to
 * sweep.
 *
 * 12 characters of a 36-symbol alphabet is ~62 bits.
 */
export function generateTicketId() {
  return `KSA-${nanoid()}`;
}

/*
 * `generateQrDataUrl` used to live here. It encoded
 * `${SITE_URL}/verify/${ticketId}` — a route that has never existed — and its
 * only caller was the abandoned `/api/events/[id]/register` handler.
 *
 * The QR on the actual ticket is produced in `ticket-generator.ts` and holds
 * the bare ticket id, which is what `/admin/check-in/[eventId]` reads back via
 * `getRegistrationByTicketId`. That path works; this one was dead code
 * pointing at a 404.
 *
 * A consequence worth knowing: scanning a ticket with a plain phone camera
 * yields the id as text rather than opening anything. Check-in goes through
 * the in-app scanner. Turning the QR into a link would mean encoding a URL
 * here *and* building the page behind it *and* teaching the scanner to strip
 * the prefix — a feature, not a fix.
 */
