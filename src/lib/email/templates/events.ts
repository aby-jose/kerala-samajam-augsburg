/** Event lifecycle email: registration, changes, reminders, aftermath. */

import type { MessageContext } from "../shell";
import { themed } from "../shell";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import {
  amount,
  esc,
  eventFacts,
  facts,
  notice,
  paragraph,
  quote,
  strong,
  type EventFacts,
} from "../blocks";

export interface EventSummary extends EventFacts {
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
  ctx: MessageContext,
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
    subject: `You're in — ${data.event.title}`,
    previewText: `Ticket ${data.ticketId} is attached as a PDF.`,
    eyebrow: "Event ticket",
    title: "You're on the list",
    accentWord: "list",
    lead: `${esc(data.name)}, your place at ${strong(t, esc(data.event.title))} is confirmed. Your ticket is attached as a PDF — keep it on your phone, or bring a printout.`,
    sections: [
      {
        label: data.event.title,
        blocks: [
          eventFacts(t, data.event),
          facts(t, [
            { label: "Ticket", value: esc(data.ticketId), mono: true, emphasis: true },
            { label: "Attendees", value: String(data.attendees) },
            owed ? null : { label: "Status", value: "Paid in full" },
          ]),
        ],
      },
      {
        label: owed ? "At the door" : undefined,
        blocks: [
          owed
            ? amount(t, {
                caption: "Still to pay",
                amount: data.amountDue,
                sub: "Your ticket is valid either way — settle up with the desk when you arrive. Cash is fine.",
              })
            : null,
        ],
      },
    ],
    close: {
      eyebrow: "See you there",
      button: { label: "View event details", href: eventUrl(data.event.slug) },
      note: "Need to change or cancel? You can do that from the event page, or just reply to this email.",
    },
  };
};

/** Acknowledges a cancellation the member made themselves. */
export const registrationCancelled = (
  ctx: MessageContext,
  data: { name: string; event: EventSummary; ticketId: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Cancelled — your place at ${data.event.title}`,
    previewText: `Ticket ${data.ticketId} is no longer valid.`,
    eyebrow: "Registration cancelled",
    title: "Your registration is cancelled",
    accentWord: "cancelled",
    lead: `${esc(data.name)}, we have released your place at ${strong(t, esc(data.event.title))}. Ticket ${esc(data.ticketId)} is no longer valid and will not be admitted.`,
    sections: [
      {
        label: data.event.title,
        blocks: [
          eventFacts(t, data.event),
          paragraph(t, "Changed your mind? You are welcome to register again while places remain."),
        ],
      },
    ],
    close: {
      eyebrow: "Changed your mind?",
      button: { label: "Register again", href: eventUrl(data.event.slug) },
      note: "If you had already paid, reply to this email and we will arrange the refund.",
    },
  };
};

/** Sent when an administrator removes someone's registration for them. */
export const registrationRemovedByAdmin = (
  ctx: MessageContext,
  data: { name: string; event: EventSummary; ticketId: string; reason?: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `We cancelled your place at ${data.event.title}`,
    previewText: `Ticket ${data.ticketId} will not be admitted.`,
    eyebrow: "Registration cancelled",
    title: "Your registration was cancelled",
    accentWord: "cancelled",
    lead: `${esc(data.name)}, we have cancelled your registration for ${strong(t, esc(data.event.title))}. Ticket ${esc(data.ticketId)} will not be admitted.`,
    sections: [
      {
        label: data.event.title,
        blocks: [
          data.reason ? quote(t, data.reason) : null,
          eventFacts(t, data.event),
          notice(t, {
            title: "Not expecting this?",
            body: `Get in touch — reply to this email or write to <a href="mailto:${esc(ctx.contactEmail)}" style="color:${t.primaryDeep};font-weight:600;">${esc(ctx.contactEmail)}</a> and we will sort it out. Anything already paid will be refunded.`,
          }),
        ],
      },
    ],
    close: {
      note: "You are receiving this because it affects a booking you made.",
    },
  };
};

/** Committee copy of a member-initiated cancellation. */
export const registrationCancelledAdminNotice = (
  ctx: MessageContext,
  data: { name: string; email: string; event: EventSummary; attendees: number; hadPaid: boolean }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Cancellation: ${data.name} — ${data.event.title}`,
    previewText: `${data.attendees} place(s) released.`,
    eyebrow: "Committee",
    title: "A registration was cancelled",
    accentWord: "cancelled",
    lead: `${strong(t, esc(data.name))} released ${strong(t, String(data.attendees))} place(s) at ${esc(data.event.title)}.`,
    sections: [
      {
        label: "Cancellation",
        blocks: [
          facts(t, [
            { label: "Member", value: esc(data.name), emphasis: true },
            { label: "Email", value: esc(data.email) },
            { label: "Event", value: esc(data.event.title) },
            { label: "Places released", value: String(data.attendees) },
            {
              label: "Payment",
              value: data.hadPaid ? "Recorded as paid" : "Nothing recorded",
            },
          ]),
          data.hadPaid
            ? notice(t, {
                title: "Action needed",
                body: "This registration was already marked paid. Arrange the refund.",
              })
            : null,
        ],
      },
    ],
    close: {
      button: { label: "Open registrations", href: absoluteUrl("/admin/registrations") },
    },
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
  ctx: MessageContext,
  data: { name: string; event: EventSummary; reason?: string; hadPaid: boolean }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Cancelled — ${data.event.title}`,
    previewText: "The event will not take place. Here is what happens next.",
    eyebrow: "Event cancelled",
    title: "This event has been cancelled",
    accentWord: "cancelled",
    lead: `${esc(data.name)}, we are sorry to tell you that ${strong(t, esc(data.event.title))} will not go ahead. We know this is disappointing, and we did not take the decision lightly.`,
    sections: [
      {
        label: data.event.title,
        blocks: [
          data.reason ? quote(t, data.reason) : null,
          eventFacts(t, data.event),
          data.hadPaid
            ? notice(t, {
                title: "Your refund",
                body: "We have your payment on record and will return it in full to the account it came from. Allow a few working days — you do not need to do anything.",
              })
            : paragraph(t, "Nothing was collected from you, so there is nothing to refund."),
        ],
      },
    ],
    close: {
      eyebrow: "What's next",
      button: { label: "See other events", href: absoluteUrl("/events") },
      note: "Your ticket is void. We hope to see you at the next one.",
    },
  };
};

/** The event is still happening, but not when or where it said. */
export const eventRescheduled = (
  ctx: MessageContext,
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
    subject: `Changed — ${data.event.title}`,
    previewText: "New details. Your existing ticket is still valid.",
    eyebrow: "Details changed",
    title: venueMoved ? "This event has moved" : "This event has a new date",
    accentWord: venueMoved ? "moved" : "new",
    lead: `${esc(data.name)}, the details for ${strong(t, esc(data.event.title))} have changed. ${strong(t, "Your existing ticket is still valid")} — there is nothing to re-book.`,
    sections: [
      {
        label: data.event.title,
        blocks: [
          data.reason ? quote(t, data.reason) : null,
          eventFacts(t, { ...data.event, previousDate: data.previousDate }),
        ],
      },
      {
        label: venueMoved ? "New venue" : undefined,
        blocks: [
          venueMoved
            ? facts(t, [
                {
                  label: "Was",
                  value: `<span style="text-decoration:line-through;color:${t.muted};font-weight:500;">${esc(data.previousLocation!)}</span>`,
                },
                { label: "Now", value: esc(data.event.location), emphasis: true },
              ])
            : null,
        ],
      },
    ],
    close: {
      button: { label: "View updated details", href: eventUrl(data.event.slug) },
      note: "If the new arrangements do not work for you, you can cancel from the event page and we will refund anything already paid.",
    },
  };
};

/** Nudge before the day. Optional mail — respects the reminder preference. */
export const eventReminder = (
  ctx: MessageContext,
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
    subject: soon ? `Today — ${data.event.title}` : `In two days — ${data.event.title}`,
    previewText: `Ticket ${data.ticketId}. Bring it on your phone or printed.`,
    eyebrow: soon ? "Today" : "In two days",
    title: soon ? "See you today" : "Coming up in two days",
    accentWord: soon ? "today" : "two days",
    lead: `${esc(data.name)}, a reminder that you are registered for ${strong(t, esc(data.event.title))}.`,
    sections: [
      {
        label: data.event.title,
        blocks: [
          eventFacts(t, data.event),
          facts(t, [
            { label: "Ticket", value: esc(data.ticketId), mono: true, emphasis: true },
            { label: "Attendees", value: String(data.attendees) },
          ]),
          data.amountDue > 0
            ? notice(t, {
                title: `€${data.amountDue.toFixed(2)} to pay at the door`,
                body: "Bringing the exact amount in cash helps the desk move faster.",
              })
            : null,
        ],
      },
    ],
    close: {
      button: { label: "View event details", href: eventUrl(data.event.slug) },
      note: "Can no longer make it? Cancel from the event page so someone on the waiting list can take your place.",
    },
  };
};

/** The day after. Optional mail. */
export const eventThankYou = (
  ctx: MessageContext,
  data: { name: string; event: EventSummary; galleryUrl?: string | null }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Thank you for coming to ${data.event.title}`,
    previewText: "Photographs are going up, and here is what's next.",
    eyebrow: "Thank you",
    title: "Thank you for being there",
    accentWord: "Thank you",
    lead: `${esc(data.name)}, thank you for joining us at ${strong(t, esc(data.event.title))}. Events like this only work because people turn up, and you did.`,
    sections: [
      {
        blocks: [
          paragraph(
            t,
            data.galleryUrl
              ? "Photographs from the day are going up now. If you took some of your own, we would love to add them to the album."
              : "Photographs will go up in the gallery shortly."
          ),
        ],
      },
    ],
    close: {
      eyebrow: "The photographs",
      button: data.galleryUrl
        ? { label: "See the photographs", href: data.galleryUrl }
        : { label: "Browse the gallery", href: absoluteUrl("/gallery") },
      note: "Anything we could do better? Reply to this email — it goes to the committee, and we read all of it.",
    },
  };
};

/** A new event is published. Optional mail — announcement preference. */
export const eventAnnouncement = (
  ctx: MessageContext,
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
    subject: `New event — ${data.event.title}`,
    previewText: summary,
    eyebrow: "New event",
    title: data.event.title,
    accentWord: data.event.title.split(" ")[0],
    lead: `${esc(data.name)}, we have just announced a new event and wanted you to hear first.`,
    sections: [
      {
        label: data.event.title,
        blocks: [
          paragraph(t, esc(summary) + (data.description.length > 220 ? "…" : "")),
          eventFacts(t, data.event),
        ],
      },
      {
        label: "Tickets",
        blocks: [
          facts(t, [
            data.memberPrice != null
              ? { label: "Members", value: `€${data.memberPrice.toFixed(2)}`, emphasis: true }
              : null,
            data.nonMemberPrice != null
              ? { label: "Non-members", value: `€${data.nonMemberPrice.toFixed(2)}` }
              : null,
          ]),
        ],
      },
    ],
    close: {
      button: { label: "Reserve your place", href: eventUrl(data.event.slug) },
    },
  };
};

/** Sent when someone tries to register for a full event. */
export const eventFull = (
  ctx: MessageContext,
  data: { name: string; event: EventSummary }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `${data.event.title} is full`,
    previewText: "We could not fit you in this time — here is how to hear first next time.",
    eyebrow: "At capacity",
    title: "We're full",
    accentWord: "full",
    lead: `${esc(data.name)}, we are sorry — ${strong(t, esc(data.event.title))} reached capacity before your registration went through, so we could not reserve a place for you.`,
    sections: [
      {
        label: data.event.title,
        blocks: [
          eventFacts(t, data.event),
          paragraph(
            t,
            "Places sometimes open up when others cancel. Keep an eye on the event page, and if one appears you can grab it."
          ),
        ],
      },
    ],
    close: {
      button: { label: "Check the event page", href: eventUrl(data.event.slug) },
      note: "Members get advance notice of new events, which is usually the difference between getting a place and reading this email.",
    },
  };
};
