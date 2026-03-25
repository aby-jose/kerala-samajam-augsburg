import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTicketId, generateQrDataUrl } from "@/lib/ticket";
import { sendEmail } from "@/lib/resend";
import { z } from "zod";

const registrationSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  attendees: z.number().min(1).max(10),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const validatedData = registrationSchema.parse(body);
    const eventId = (await params).id;

    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Check if registration is allowed (mock check for now)
    // In a real app, check config and max attendees

    const ticketId = generateTicketId();

    const registration = await prisma.registration.create({
      data: {
        ticketId,
        eventId,
        name: validatedData.name,
        email: validatedData.email,
        phone: validatedData.phone,
        attendees: validatedData.attendees,
      },
    });

    // In a production app, you might want to send the email asynchronously
    // or use a background job since QR generation and email sending can be slow.
    // For now, we'll send it and return.

    const qrDataUrl = await generateQrDataUrl(ticketId);

    // Send confirmation email
    // This is a placeholder for the actual email template
    /*
    await sendEmail({
      to: validatedData.email,
      subject: `Registration Confirmed: ${event.title}`,
      react: <RegistrationEmail event={event} ticket={registration} qrCode={qrDataUrl} />,
    });
    */

    return NextResponse.json({
      success: true,
      registration: {
        id: registration.id,
        ticketId: registration.ticketId,
        qrCode: qrDataUrl,
      },
    });
  } catch (error) {
    console.error("Registration API Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
