/**
 * Sample arguments for every template.
 *
 * One registry, two consumers: `email-preview.ts` renders it to disk and
 * `tests/email.test.ts` asserts invariants over it. A template with no fixture
 * fails the coverage test, so this file cannot silently fall behind — which is
 * the failure mode that let an eighth template file sit unnoticed behind a
 * seven-file survey.
 *
 * Development data. It lives in `scripts/` so it is never bundled into the app.
 *
 * Two contexts, deliberately:
 *
 *   `testContext()`    synchronous, built from `defaultConfig`. Deterministic,
 *                      and needs no database — a test suite that fails when
 *                      Mongo is unreachable is a test suite people stop running.
 *   `previewContext()` asynchronous, reads the live config so the gallery shows
 *                      the association's real brand colour, name and address.
 */

import { defaultConfig, type SiteConfig } from "../src/lib/config-schema";
import { templates } from "../src/lib/email";
import type { TemplateOutput } from "../src/lib/email/send";
import type { MessageContext } from "../src/lib/email/shell";

export interface Fixture {
  /** Filename stem in `.email-preview/`. */
  id: string;
  /** The module it comes from — must match a key of `templates`. */
  group: string;
  /** The exported function name — must match a key of that module. */
  name: string;
  build: (ctx: MessageContext) => TemplateOutput;
}

// --- Shared sample data ------------------------------------------------------

export const EVENT = {
  title: "Onam Celebration 2026",
  slug: "onam-2026",
  date: new Date("2026-09-12T17:00:00Z"),
  startTime: "17:00",
  endTime: "22:30",
  location: "Zeughaus Augsburg",
  address: "Zeugplatz 4, 86150 Augsburg",
};

export const BANK = {
  accountHolder: "Kerala Samajam Augsburg e.V.",
  bankName: "Stadtsparkasse Augsburg",
  iban: "DE89 3704 0044 0532 0130 00",
  bic: "AUGSDE77XXX",
};

// --- The registry ------------------------------------------------------------

export const FIXTURES: Fixture[] = [
  // --- payments ---------------------------------------------------------
  {
    id: "payments-request", group: "payments", name: "membershipPaymentRequest",
    build: (ctx) => templates.payments.membershipPaymentRequest(ctx, {
      name: "Ammu", planName: "Family", amount: 45, reference: "KSA-MEM-2026-0417",
      dueDate: new Date("2026-09-30"), bank: BANK, method: "BANK",
    }),
  },
  {
    id: "payments-received", group: "payments", name: "membershipPaymentReceived",
    build: (ctx) => templates.payments.membershipPaymentReceived(ctx, {
      name: "Ammu", planName: "Family", amount: 45,
      startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"),
      term: "12 months", reference: "KSA-MEM-2026-0417",
    }),
  },
  {
    id: "payments-event-recorded", group: "payments", name: "eventPaymentRecorded",
    build: (ctx) => templates.payments.eventPaymentRecorded(ctx, {
      name: "Ammu", eventTitle: EVENT.title, eventSlug: EVENT.slug,
      ticketId: "KSA-8F42-9C11", amount: 36, method: "CASH",
      paidAt: new Date("2026-08-14"), reference: null,
    }),
  },
  {
    id: "payments-event-reverted", group: "payments", name: "eventPaymentReverted",
    build: (ctx) => templates.payments.eventPaymentReverted(ctx, {
      name: "Ammu", eventTitle: EVENT.title, eventSlug: EVENT.slug,
      ticketId: "KSA-8F42-9C11", amount: 36,
    }),
  },
  {
    id: "payments-overdue", group: "payments", name: "paymentOverdue",
    build: (ctx) => templates.payments.paymentOverdue(ctx, {
      name: "Ammu", planName: "Family", amount: 45, reference: "KSA-MEM-2026-0417",
      dueDate: new Date("2026-07-01"), daysOverdue: 46, bank: BANK, finalNotice: true,
    }),
  },
  {
    id: "payments-digest", group: "payments", name: "adminPaymentDigest",
    build: (ctx) => templates.payments.adminPaymentDigest(ctx, {
      recorded: 7, recordedTotal: 315, outstanding: 3, outstandingTotal: 135,
      overdue: 1, newApplications: 2,
    }),
  },

  // --- account ----------------------------------------------------------
  {
    id: "account-verify", group: "account", name: "verifyEmail",
    build: (ctx) => templates.account.verifyEmail(ctx, {
      verifyLink: "https://keralasamajam.de/verify-email?token=8f42a1",
    }),
  },
  {
    id: "account-welcome", group: "account", name: "welcome",
    build: (ctx) => templates.account.welcome(ctx, { name: "Ammu" }),
  },
  {
    id: "account-otp", group: "account", name: "otpCode",
    build: (ctx) => templates.account.otpCode(ctx, { code: "482913" }),
  },
  {
    id: "account-reset", group: "account", name: "passwordReset",
    build: (ctx) => templates.account.passwordReset(ctx, {
      resetLink: "https://keralasamajam.de/reset-password?token=8f42a1",
    }),
  },
  {
    id: "account-password-changed", group: "account", name: "passwordChanged",
    build: (ctx) => templates.account.passwordChanged(ctx, {
      name: "Ammu", changedAt: new Date("2026-08-16T09:20:00Z"),
    }),
  },
  {
    id: "account-email-changed", group: "account", name: "emailChanged",
    build: (ctx) => templates.account.emailChanged(ctx, {
      name: "Ammu", oldEmail: "ammu.old@example.org",
      newEmail: "ammu@example.org", audience: "old",
    }),
  },

  // --- events -----------------------------------------------------------
  {
    id: "events-ticket", group: "events", name: "ticket",
    build: (ctx) => templates.events.ticket(ctx, {
      name: "Ammu", event: EVENT, ticketId: "KSA-8F42-9C11",
      attendees: 4, amountDue: 36, pricePaid: 0,
    }),
  },
  {
    id: "events-cancelled-self", group: "events", name: "registrationCancelled",
    build: (ctx) => templates.events.registrationCancelled(ctx, {
      name: "Ammu", event: EVENT, ticketId: "KSA-8F42-9C11",
    }),
  },
  {
    id: "events-removed", group: "events", name: "registrationRemovedByAdmin",
    build: (ctx) => templates.events.registrationRemovedByAdmin(ctx, {
      name: "Ammu", event: EVENT, ticketId: "KSA-8F42-9C11",
      reason: "Duplicate booking under the same name.",
    }),
  },
  {
    id: "events-cancel-notice", group: "events", name: "registrationCancelledAdminNotice",
    build: (ctx) => templates.events.registrationCancelledAdminNotice(ctx, {
      name: "Ammu", email: "ammu@example.org", event: EVENT,
      attendees: 4, hadPaid: true,
    }),
  },
  {
    id: "events-event-cancelled", group: "events", name: "eventCancelled",
    build: (ctx) => templates.events.eventCancelled(ctx, {
      name: "Ammu", event: EVENT,
      reason: "The venue withdrew at short notice.", hadPaid: true,
    }),
  },
  {
    id: "events-rescheduled", group: "events", name: "eventRescheduled",
    build: (ctx) => templates.events.eventRescheduled(ctx, {
      name: "Ammu", event: EVENT,
      previousDate: new Date("2026-09-05T17:00:00Z"),
      previousLocation: "Kongress am Park",
    }),
  },
  {
    id: "events-reminder", group: "events", name: "eventReminder",
    build: (ctx) => templates.events.eventReminder(ctx, {
      name: "Ammu", event: EVENT, ticketId: "KSA-8F42-9C11",
      attendees: 4, amountDue: 36, when: "same-day",
    }),
  },
  {
    id: "events-thank-you", group: "events", name: "eventThankYou",
    build: (ctx) => templates.events.eventThankYou(ctx, {
      name: "Ammu", event: EVENT, galleryUrl: null,
    }),
  },
  {
    id: "events-announcement", group: "events", name: "eventAnnouncement",
    build: (ctx) => templates.events.eventAnnouncement(ctx, {
      name: "Ammu", event: EVENT,
      description: "An afternoon of sadhya, dance and music at the Zeughaus. Doors from five.",
      memberPrice: 12, nonMemberPrice: 18,
    }),
  },
  {
    id: "events-full", group: "events", name: "eventFull",
    build: (ctx) => templates.events.eventFull(ctx, { name: "Ammu", event: EVENT }),
  },

  // --- membership -------------------------------------------------------
  {
    id: "membership-student-applied", group: "membership", name: "studentApplicationReceived",
    build: (ctx) => templates.membership.studentApplicationReceived(ctx, {
      name: "Ammu", planName: "Student",
    }),
  },
  {
    id: "membership-applied", group: "membership", name: "applicationReceived",
    build: (ctx) => templates.membership.applicationReceived(ctx, {
      name: "Ammu", planName: "Family", amount: 45,
    }),
  },
  {
    id: "membership-admin-notice", group: "membership", name: "applicationAdminNotice",
    build: (ctx) => templates.membership.applicationAdminNotice(ctx, {
      memberName: "Ammu", memberEmail: "ammu@example.org", planName: "Student",
    }),
  },
  {
    id: "membership-student-verified", group: "membership", name: "studentVerified",
    build: (ctx) => templates.membership.studentVerified(ctx, {
      name: "Ammu", planName: "Student",
    }),
  },
  {
    id: "membership-rejected", group: "membership", name: "applicationRejected",
    build: (ctx) => templates.membership.applicationRejected(ctx, {
      name: "Ammu", planName: "Student",
      reason: "The enrolment date on the card had already passed.",
    }),
  },
  {
    id: "membership-active", group: "membership", name: "membershipActive",
    build: (ctx) => templates.membership.membershipActive(ctx, {
      name: "Ammu", planName: "Family",
      startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), features: [],
    }),
  },
  {
    id: "membership-expiring", group: "membership", name: "membershipExpiring",
    build: (ctx) => templates.membership.membershipExpiring(ctx, {
      name: "Ammu", planName: "Family",
      endDate: new Date("2026-08-23"), daysLeft: 7, amount: 45,
    }),
  },
  {
    id: "membership-expired", group: "membership", name: "membershipExpired",
    build: (ctx) => templates.membership.membershipExpired(ctx, {
      name: "Ammu", planName: "Family", endDate: new Date("2026-08-01"),
    }),
  },
  {
    id: "membership-renewed", group: "membership", name: "membershipRenewed",
    build: (ctx) => templates.membership.membershipRenewed(ctx, {
      name: "Ammu", planName: "Family",
      startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"),
    }),
  },

  // --- privacy ----------------------------------------------------------
  {
    id: "privacy-export", group: "privacy", name: "dataExportReady",
    build: (ctx) => templates.privacy.dataExportReady(ctx, {
      name: "Ammu", requestedAt: new Date("2026-08-10"),
    }),
  },
  {
    id: "privacy-deletion-requested", group: "privacy", name: "deletionRequested",
    build: (ctx) => templates.privacy.deletionRequested(ctx, {
      name: "Ammu", requestedAt: new Date("2026-08-10"), deadline: new Date("2026-09-10"),
    }),
  },
  {
    id: "privacy-deletion-admin", group: "privacy", name: "deletionAdminNotice",
    build: (ctx) => templates.privacy.deletionAdminNotice(ctx, {
      memberName: "Ammu", memberEmail: "ammu@example.org",
      requestedAt: new Date("2026-08-10"), deadline: new Date("2026-09-10"),
      hasActiveMembership: true,
    }),
  },
  {
    id: "privacy-deletion-cancelled", group: "privacy", name: "deletionCancelled",
    build: (ctx) => templates.privacy.deletionCancelled(ctx, { name: "Ammu" }),
  },
  {
    id: "privacy-deletion-completed", group: "privacy", name: "deletionCompleted",
    build: (ctx) => templates.privacy.deletionCompleted(ctx, {
      name: "Ammu", completedAt: new Date("2026-09-01"),
    }),
  },
  {
    id: "privacy-legal-update", group: "privacy", name: "legalUpdate",
    build: (ctx) => templates.privacy.legalUpdate(ctx, {
      name: "Ammu", documentTitle: "Privacy Policy",
      changeNote: "We now name our email provider and its data-processing location.",
      requiresConsent: true, effectiveFrom: new Date("2026-09-01"),
    }),
  },
];

// --- Contexts ----------------------------------------------------------------

/** Deterministic context for tests. No database, no environment. */
export function testContext(): MessageContext {
  return {
    siteName: defaultConfig.siteName,
    contactEmail: defaultConfig.contactEmail,
    branding: {
      logoUrl: defaultConfig.branding.logoUrl,
      siteName: defaultConfig.siteName,
      primaryColor: defaultConfig.branding.primaryColor,
    },
    legal: defaultConfig.legal,
  };
}

/**
 * The real site config, falling back to defaults without a database.
 *
 * Queried directly rather than through `getConfig()`, which is wrapped in
 * React's `cache()` and expects a request context.
 */
export async function previewContext(): Promise<{ ctx: MessageContext; source: string }> {
  let config: SiteConfig = defaultConfig;
  let source = "defaults";

  try {
    const { prisma } = await import("../src/lib/prisma");
    const record = await prisma.config.findUnique({ where: { key: "current" } });
    await prisma.$disconnect();

    if (record?.value) {
      const stored = record.value as Partial<SiteConfig>;
      config = {
        ...defaultConfig,
        ...stored,
        branding: { ...defaultConfig.branding, ...stored.branding },
        legal: { ...defaultConfig.legal, ...stored.legal },
      };
      source = "database";
    } else {
      source = "defaults (nothing saved)";
    }
  } catch (error) {
    source = `defaults (${error instanceof Error ? error.message.split("\n")[0] : String(error)})`;
  }

  return {
    ctx: {
      siteName: config.siteName,
      contactEmail: config.contactEmail,
      branding: {
        logoUrl: config.branding.logoUrl,
        siteName: config.siteName,
        // The override exists to check that the derived palette holds at any
        // brand colour. Unset — the normal case — the site's own is used.
        primaryColor: process.env.PREVIEW_BRAND || config.branding.primaryColor,
      },
      legal: config.legal,
    },
    source,
  };
}

/** Every exported template, as `group/name` keys. Drives the coverage test. */
export function allTemplateKeys(): string[] {
  return Object.entries(templates).flatMap(([group, mod]) =>
    Object.keys(mod as Record<string, unknown>).map((name) => `${group}/${name}`)
  );
}
