import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTicketPDF } from "@/lib/ticket-generator";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const { ticketId } = await params;

  if (!ticketId) {
    return new NextResponse("Missing Ticket ID", { status: 400 });
  }

  try {
    const registration = await prisma.registration.findUnique({
      where: { ticketId },
      include: { event: true },
    });

    if (!registration) {
      return new NextResponse("Ticket not found", { status: 404 });
    }

    // Only allow downloading if paid OR if it's a cash payment (admin will verify later, but user can still see the ticket)
    // Actually, usually we only allow it if paymentStatus is PAID.
    // But for CASH, it might be PENDING until admin approves.
    // Let's check the current logic in ticket-actions.ts:
    // if (registration.paymentStatus !== "PAID") throw new Error("Payment not confirmed");
    
    if (registration.paymentStatus !== "PAID" && registration.paymentMethod !== "CASH") {
        return new NextResponse("Payment not confirmed", { status: 402 });
    }

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

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set(
      "Content-Disposition",
      `attachment; filename="Ticket-${registration.ticketId}.pdf"`
    );

    return new NextResponse(new Uint8Array(pdfBuffer), { headers });
  } catch (error) {
    console.error("Ticket generation error:", error);
    return new NextResponse("Failed to generate ticket", { status: 500 });
  }
}
