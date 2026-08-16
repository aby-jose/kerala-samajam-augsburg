import { prisma } from "./prisma";
import { generateTicketPDF } from "./ticket-generator";
import { sendMail, templates } from "./email";

/**
 * Deliberately *not* a `"use server"` module.
 *
 * Every export of a `"use server"` file is a POST endpoint the browser can
 * reach, and this one takes a registration id and mails a PDF. As an action it
 * let anyone walk ids and spam members with their own tickets on our Resend
 * quota. It is only ever called from `registerForEvent` and from the admin
 * action that records a payment, both already on the server, so it does not
 * need to be an action at all.
 *
 * The "payment confirmed" guard is gone. Every registration is settled in
 * person or by transfer now, so holding the ticket back until an administrator
 * had keyed the payment in would mean nobody could be admitted to an event
 * they had not pre-paid for. The ticket states what is still owed instead.
 */
export async function sendEventTicket(registrationId: string) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  });

  if (!registration) throw new Error("Registration not found");

  const amountDue = registration.paymentStatus === "PAID" ? 0 : registration.pricePaid || 0;

  /**
   * The PDF is built before the send, and a failure here is not fatal.
   *
   * pdfkit reads font metrics off disk and has broken on deployment more than
   * once. Previously that took the whole email with it — the caller caught the
   * throw, logged it, and the member received nothing at all, when a
   * confirmation naming the date and venue would have been most of the value.
   * So: try for the attachment, send regardless.
   */
  let pdf: Buffer | null = null;
  try {
    pdf = await generateTicketPDF({
      ticketId: registration.ticketId,
      eventName: registration.event.title,
      eventDate: registration.event.date,
      eventLocation: registration.event.location,
      userName: registration.name,
      userEmail: registration.email,
      attendees: registration.attendees,
      pricePaid: registration.pricePaid || 0,
      amountDue,
    });
  } catch (error) {
    console.error(`[ticket] PDF generation failed for ${registration.ticketId}:`, error);
  }

  const result = await sendMail({
    template: "event.ticket",
    to: registration.email,
    entityId: registration.id,
    attachments: pdf
      ? [
          {
            filename: `Ticket-${registration.ticketId}.pdf`,
            content: pdf,
            contentType: "application/pdf",
          },
        ]
      : undefined,
    build: (ctx) =>
      templates.events.ticket(ctx, {
        name: registration.name,
        event: {
          slug: registration.event.slug,
          title: registration.event.title,
          date: registration.event.date,
          startTime: registration.event.startTime,
          endTime: registration.event.endTime,
          location: registration.event.location,
          address: registration.event.address,
        },
        ticketId: registration.ticketId,
        attendees: registration.attendees,
        amountDue,
        pricePaid: registration.pricePaid || 0,
      }),
  });

  return { success: result.ok, error: result.error, attachedPdf: !!pdf };
}
