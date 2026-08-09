"use server";

import { prisma } from "./prisma";
import { generateTicketPDF } from "./ticket-generator";
import { sendEmail } from "./email";
import { revalidatePath } from "next/cache";

export async function sendEventTicket(registrationId: string) {
  try {
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: { event: true },
    });

    if (!registration) throw new Error("Registration not found");
    if (registration.paymentStatus !== "PAID") throw new Error("Payment not confirmed");

    const pdfBuffer = await generateTicketPDF({
      ticketId: registration.ticketId,
      eventName: registration.event.title,
      eventDate: registration.event.date,
      eventLocation: registration.event.location,
      userName: registration.name,
      userEmail: registration.email,
      attendees: registration.attendees,
      pricePaid: registration.pricePaid || 0,
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
