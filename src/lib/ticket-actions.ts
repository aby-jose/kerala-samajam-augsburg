import { prisma } from "./prisma";
import { generateTicketPDF } from "./ticket-generator";
import { sendEmail } from "./email";

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
  try {
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: { event: true },
    });

    if (!registration) throw new Error("Registration not found");

    const amountDue =
      registration.paymentStatus === "PAID" ? 0 : registration.pricePaid || 0;

    const pdfBuffer = await generateTicketPDF({
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

    await sendEmail({
      to: registration.email,
      subject: `Your Ticket: ${registration.event.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #e11d48; padding: 20px; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Ticket Confirmed!</h1>
          </div>
          <div style="padding: 30px; line-height: 1.6; color: #333;">
            <p>Dear <strong>${registration.name}</strong>,</p>
            <p>Your registration for <strong>${registration.event.title}</strong> has been successfully confirmed.</p>

            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #e11d48;">
              <p style="margin: 0;"><strong>Event:</strong> ${registration.event.title}</p>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${registration.event.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p style="margin: 5px 0;"><strong>Location:</strong> ${registration.event.location}</p>
              <p style="margin: 5px 0;"><strong>Attendees:</strong> ${registration.attendees}</p>
            </div>

            ${amountDue > 0 ? `
            <div style="background-color: #fffbeb; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; font-weight: 600;">Amount due: €${amountDue.toFixed(2)}</p>
              <p style="margin: 5px 0 0; font-size: 14px;">Please settle this at the door when you arrive. Your ticket is valid either way.</p>
            </div>
            ` : ""}

            <p>We have attached your official entry ticket as a PDF to this email. Please keep it handy (digital or printed) for check-in at the venue.</p>

            <p>See you there!</p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            
            <p style="font-size: 12px; color: #666; text-align: center;">
              This is an automated message from Kerala Samajam Augsburg e.V.<br/>
              If you have any questions, please reply to this email.
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Ticket-${registration.ticketId}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    console.log(`✅ Ticket sent to ${registration.email}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to send ticket:", error);
    throw error;
  }
}
