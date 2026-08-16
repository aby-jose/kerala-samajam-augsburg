/** Event lifecycle email: registration, changes, reminders, aftermath. */

import type { EmailContext } from "../layout";
import { themed } from "../layout";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import {
  amountCard,
  button,
  dataCard,
  esc,
  eventCard,
  note,
  notice,
  paragraph,
  quote,
  stack,
  statusPill,
  strong,
  type EventCardData,
} from "../components";

export interface EventSummary extends EventCardData {
  slug: string;
}

const eventUrl = (slug: string) => absoluteUrl(`/events/${slug}`);

/**
 * The registration confirmation, carrying the ticket PDF.
 *
 * This replaces a block of hand-written inline HTML that bypassed the base
 * template entirely and hardcoded the brand colour, so re-branding the site
 * left the single most frequently sent email untouched. It also interpolated
 * the attendee's name and the event title without escaping, which is the one
 * place in this system where a stranger controls a string that reaches
 * somebody else's inbox.
 */
export const ticket = (
  ctx: EmailContext,
  data: {
    name: string;
    event: EventSummary;
    ticketId: string;
    attendees: number;
    amountDue: number;
    pricePaid: number;
  }
): TemplateOutput => {
  const t = themed(ctx);
  const owed = data.amountDue > 0;

  return {
    subject: `You're going to ${data.event.title}`,
    previewText: `Ticket ${data.ticketId} for ${data.event.title} — the PDF is attached.`,
    eyebrow: "Ticket confirmed",
    tone: "success",
    title: "You're on the list",
    lead: `${esc(data.name)}, your place at ${strong(t, esc(data.event.title))} is confirmed. Your ticket is attached as a PDF — keep it on your phone or bring a printout.`,
    body: stack([
      eventCard(t, data.event),
      dataCard(t, {
        title: "Your booking",
        rows: [
          { label: "Ticket", value: esc(data.ticketId), mono: true, emphasis: true },
          { label: "Attendees", value: String(data.attendees) },
          {
            label: "Status",
            value: owed ? `€${data.amountDue.toFixed(2)} due at the door` : "Paid in full",
          },
        ],
      }),
      owed
        ? amountCard(t, {
            caption: "To pay at the door",
            amount: data.amountDue,
            tone: "warning",
            sub: "Your ticket is valid either way — settle up with the desk when you arrive. Cash is fine.",
          })
        : null,
    ]),
    action: button(t, "View event details", eventUrl(data.event.slug)),
    note: note(
      t,
      "Need to change or cancel? You can do that from the event page, or just reply to this email."
    ),
  };
};

/** Acknowledges a cancellation the member made themselves. */
export const registrationCancelled = (
  ctx: EmailContext,
  data: { name: string; event: EventSummary; ticketId: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Cancelled: your place at ${data.event.title}`,
    previewText: `Your registration for ${data.event.title} has been cancelled.`,
    eyebrow: "Registration cancelled",
    tone: "neutral",
    title: "Your registration is cancelled",
    lead: `${esc(data.name)}, we have released your place at ${strong(t, esc(data.event.title))}. Ticket ${esc(data.ticketId)} is no longer valid and will not be admitted.`,
    body: stack([
      eventCard(t, data.event),
      paragraph(t, "Changed your mind? You are welcome to register again while places remain."),
    ]),
    action: button(t, "Register again", eventUrl(data.event.slug), { variant: "secondary" }),
    note: note(t, "If you had already paid, reply to this email and we will arrange the refund."),
  };
};

/** Sent when an administrator removes someone's registration for them. */
export const registrationRemovedByAdmin = (
  ctx: EmailContext,
  data: { name: string; event: EventSummary; ticketId: string; reason?: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Your registration for ${data.event.title} was cancelled`,
    previewText: `We have cancelled your place at ${data.event.title}.`,
    eyebrow: "Registration cancelled",
    tone: "warning",
    title: "Your registration was cancelled",
    lead: `${esc(data.name)}, we have cancelled your registration for ${strong(t, esc(data.event.title))}. Ticket ${esc(data.ticketId)} will not be admitted.`,
    body: stack([
      data.reason ? quote(t, data.reason) : null,
      eventCard(t, data.event),
      notice(t, {
        title: "Not expecting this?",
        body: `Get in touch — reply to this email or write to <a href="mailto:${esc(ctx.contactEmail)}" style="color:${t.primaryDeep};font-weight:600;">${esc(ctx.contactEmail)}</a> and we will sort it out. Anything already paid will be refunded.`,
        tone: "neutral",
      }),
    ]),
  };
};

/** Committee copy of a member-initiated cancellation. */
export const registrationCancelledAdminNotice = (
  ctx: EmailContext,
  data: { name: string; email: string; event: EventSummary; attendees: number; hadPaid: boolean }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Cancellation: ${data.name} — ${data.event.title}`,
    previewText: `${data.name} cancelled ${data.attendees} place(s) at ${data.event.title}.`,
    eyebrow: "Committee",
    tone: data.hadPaid ? "warning" : "neutral",
    title: "A registration was cancelled",
    body: stack([
      dataCard(t, {
        title: "Cancellation",
        rows: [
          { label: "Member", value: esc(data.name), emphasis: true },
          { label: "Email", value: esc(data.email) },
          { label: "Event", value: esc(data.event.title) },
          { label: "Places released", value: String(data.attendees) },
          {
            label: "Payment",
            value: data.hadPaid ? "Recorded as paid" : "Nothing recorded",
          },
        ],
      }),
      data.hadPaid
        ? notice(t, {
            title: "Action needed",
            body: "This registration was already marked paid. Arrange the refund.",
            tone: "warning",
          })
        : null,
    ]),
    action: button(t, "Open registrations", absoluteUrl("/admin/registrations")),
  };
};

/**
 * The event is off.
 *
 * Broadcast to everyone holding a registration. There was previously no way to
 * express this at all — an event could only be deleted, which discarded the
 * registrations and with them any means of telling the people who had planned
 * their weekend around it.
 */
export const eventCancelled = (
  ctx: EmailContext,
  data: { name: string; event: EventSummary; reason?: string; hadPaid: boolean }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Cancelled: ${data.event.title}`,
    previewText: `${data.event.title} will not take place. Here is what happens next.`,
    eyebrow: "Event cancelled",
    tone: "danger",
    title: "This event has been cancelled",
    lead: `${esc(data.name)}, we are sorry to tell you that ${strong(t, esc(data.event.title))} will not go ahead. We know this is disappointing, and we did not take the decision lightly.`,
    body: stack([
      data.reason ? quote(t, data.reason) : null,
      eventCard(t, data.event),
      data.hadPaid
        ? notice(t, {
            title: "Your refund",
            body: "We have your payment on record and will return it in full to the account it came from. Allow a few working days — you do not need to do anything.",
            tone: "success",
          })
        : paragraph(t, "Nothing was collected from you, so there is nothing to refund."),
      paragraph(t, "Your ticket is void. We hope to see you at the next one."),
    ]),
    action: button(t, "See other events", absoluteUrl("/events")),
  };
};

/** The event is still happening, but not when or where it said. */
export const eventRescheduled = (
  ctx: EmailContext,
  data: {
    name: string;
    event: EventSummary;
    previousDate?: Date | null;
    previousLocation?: string | null;
    reason?: string;
  }
): TemplateOutput => {
  const t = themed(ctx);
  const venueMoved = !!data.previousLocation && data.previousLocation !== data.event.location;

  return {
    subject: `Changed: ${data.event.title}`,
    previewText: `${data.event.title} has new details. Your ticket is still valid.`,
    eyebrow: "Details changed",
    tone: "warning",
    title: venueMoved ? "This event has moved" : "This event has a new date",
    lead: `${esc(data.name)}, the details for ${strong(t, esc(data.event.title))} have changed. ${strong(t, "Your existing ticket is still valid")} — there is nothing to re-book.`,
    body: stack([
      data.reason ? quote(t, data.reason) : null,
      eventCard(t, { ...data.event, previousDate: data.previousDate }),
      venueMoved
        ? dataCard(t, {
            title: "New venue",
            tone: "warning",
            rows: [
              {
                label: "Was",
                value: `<span style="text-decoration:line-through;color:${t.muted};font-weight:500;">${esc(data.previousLocation!)}</span>`,
              },
              { label: "Now", value: esc(data.event.location), emphasis: true },
            ],
          })
        : null,
      paragraph(
        t,
        "If the new arrangements do not work for you, you can cancel from the event page and we will refund anything already paid."
      ),
    ]),
    action: button(t, "View updated details", eventUrl(data.event.slug)),
  };
};

/** Nudge before the day. Optional mail — respects the reminder preference. */
export const eventReminder = (
  ctx: EmailContext,
  data: {
    name: string;
    event: EventSummary;
    ticketId: string;
    attendees: number;
    amountDue: number;
    when: "2-days" | "same-day";
  }
): TemplateOutput => {
  const t = themed(ctx);
  const soon = data.when === "same-day";

  return {
    subject: soon ? `Today: ${data.event.title}` : `In two days: ${data.event.title}`,
    previewText: soon
      ? `${data.event.title} is today. Ticket ${data.ticketId}.`
      : `${data.event.title} is on ${new Date(data.event.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}.`,
    eyebrow: soon ? "Today" : "In two days",
    title: soon ? "See you today" : "Coming up in two days",
    lead: `${esc(data.name)}, a reminder that you are registered for ${strong(t, esc(data.event.title))}.`,
    body: stack([
      eventCard(t, data.event),
      dataCard(t, {
        title: "Your booking",
        rows: [
          { label: "Ticket", value: esc(data.ticketId), mono: true, emphasis: true },
          { label: "Attendees", value: String(data.attendees) },
        ],
        footnote:
          "Bring your ticket — the PDF from your confirmation email, or a screenshot of the QR code. Either scans fine.",
      }),
      data.amountDue > 0
        ? notice(t, {
            title: `€${data.amountDue.toFixed(2)} to pay at the door`,
            body: "Bringing the exact amount in cash helps the desk move faster.",
            tone: "warning",
          })
        : null,
    ]),
    action: button(t, "View event details", eventUrl(data.event.slug)),
    note: note(
      t,
      "Can no longer make it? Cancel from the event page so someone on the waiting list can take your place."
    ),
  };
};

/** The day after. Optional mail. */
export const eventThankYou = (
  ctx: EmailContext,
  data: { name: string; event: EventSummary; galleryUrl?: string | null }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Thank you for coming to ${data.event.title}`,
    previewText: "We hope you enjoyed it. Photographs, and what's next.",
    eyebrow: "Thank you",
    tone: "success",
    title: "Thank you for being there",
    lead: `${esc(data.name)}, thank you for joining us at ${strong(t, esc(data.event.title))}. Events like this only work because people turn up, and you did.`,
    body: paragraph(
      t,
      data.galleryUrl
        ? "Photographs from the day are going up now. If you took some of your own, we would love to add them to the album."
        : "Photographs will go up in the gallery shortly."
    ),
    action: data.galleryUrl
      ? button(t, "See the photographs", data.galleryUrl)
      : button(t, "Browse the gallery", absoluteUrl("/gallery")),
    note: note(
      t,
      "Anything we could do better? Reply to this email — it goes to the committee, and we read all of it."
    ),
  };
};

/** A new event is published. Optional mail — announcement preference. */
export const eventAnnouncement = (
  ctx: EmailContext,
  data: {
    name: string;
    event: EventSummary;
    description: string;
    memberPrice?: number | null;
    nonMemberPrice?: number | null;
  }
): TemplateOutput => {
  const t = themed(ctx);
  const summary = data.description.replace(/<[^>]+>/g, "").slice(0, 220);

  return {
    subject: `New event: ${data.event.title}`,
    previewText: summary,
    eyebrow: "New event",
    title: data.event.title,
    lead: `${esc(data.name)}, we have just announced a new event and wanted you to hear first.`,
    body: stack([
      paragraph(t, esc(summary) + (data.description.length > 220 ? "…" : "")),
      eventCard(t, data.event),
      dataCard(t, {
        title: "Tickets",
        rows: [
          data.memberPrice != null
            ? { label: "Members", value: `€${data.memberPrice.toFixed(2)}`, emphasis: true }
            : null,
          data.nonMemberPrice != null
            ? { label: "Non-members", value: `€${data.nonMemberPrice.toFixed(2)}` }
            : null,
        ],
      }),
    ]),
    action: button(t, "Reserve your place", eventUrl(data.event.slug)),
  };
};

/** Sent when someone tries to register for a full event. */
export const eventFull = (
  ctx: EmailContext,
  data: { name: string; event: EventSummary }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `${data.event.title} is full`,
    previewText: "We could not fit you in this time — here is how to hear first next time.",
    eyebrow: "At capacity",
    tone: "warning",
    title: "We're full",
    lead: `${esc(data.name)}, we are sorry — ${strong(t, esc(data.event.title))} reached capacity before your registration went through, so we could not reserve a place for you.`,
    body: stack([
      eventCard(t, data.event),
      paragraph(
        t,
        "Places sometimes open up when others cancel. Keep an eye on the event page, and if one appears you can grab it."
      ),
    ]),
    action: button(t, "Check the event page", eventUrl(data.event.slug)),
    note: note(
      t,
      "Members get advance notice of new events, which is usually the difference between getting a place and reading this email."
    ),
  };
};
