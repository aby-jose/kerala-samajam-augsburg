import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTicketPDF } from "@/lib/ticket-generator";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Serve a registration's ticket as a PDF.
 *
 * Most registrations are anonymous — there is no account to check the caller
 * against — so the ticket id itself is the credential, the way a payment
 * receipt link is. That only holds while the id is unguessable and cannot be
 * swept, so two things back it up: ids now come from a CSPRNG
 * (`generateTicketId`), and misses are rate limited per client below.
 *
 * The PDF carries the holder's name, email and what they owe, so an unknown
 * id gets a flat 404 rather than anything that confirms the id exists.
 */

/** Failed lookups allowed per client per window, before enumeration is assumed. */
const MISS_LIMIT = 10;
const MISS_WINDOW_MS = 10 * 60 * 1000;

function clientKey(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip");
  return `ticket-pdf:${ip || "unknown"}`;
}

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

    // Every registration is settled offline now, so a ticket is downloadable
    // before the committee has recorded the payment — the holder still needs
    // it to get in the door, and the PDF states what is outstanding.
    if (!registration) {
      // Only unsuccessful attempts count, so somebody re-downloading their own
      // ticket is never throttled while a sweep runs out of budget quickly.
      const { ok } = rateLimit(clientKey(req), MISS_LIMIT, MISS_WINDOW_MS);
      if (!ok) {
        return new NextResponse("Too many requests", { status: 429 });
      }
      return new NextResponse("Ticket not found", { status: 404 });
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
      amountDue: registration.paymentStatus === "PAID" ? 0 : registration.pricePaid || 0,
    });

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set(
      "Content-Disposition",
      `attachment; filename="Ticket-${registration.ticketId}.pdf"`
    );
    // Holds personal data — keep it out of shared caches and off search engines.
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow");

    return new NextResponse(new Uint8Array(pdfBuffer), { headers });
  } catch (error) {
    console.error("Ticket generation error:", error);
    return new NextResponse("Failed to generate ticket", { status: 500 });
  }
}
