/**
 * Scheduled email.
 *
 * Not a `"use server"` module — these are called from the cron routes in
 * `app/api/cron/*`, which authenticate with `CRON_SECRET`. Exposed as server
 * actions they would be public endpoints that mail the entire membership.
 *
 * Every job here is idempotent through `sendMail`'s `once` flag, which checks
 * for a prior SENT row on the same `(template, entityId)` pair. That is not a
 * nicety: a cron that retries, a deploy that overlaps a run, or two instances
 * firing the same schedule would otherwise mail everyone twice, and there is
 * no way to un-send. The `entityId` for a recurring notice therefore includes
 * the occasion — `${subscriptionId}:30` — so next year's reminder is a
 * different key from this year's.
 */

import { prisma } from "./prisma";
import { getConfig } from "./config-utils";
import { sendMail, sendMailBatch, templates } from "./email";
import { adminEmailOrNull } from "./admin-contact";
import { paymentDueDate, paymentReferenceFor, SUBSCRIPTION_STATUS } from "./membership-term";

export interface JobResult {
  job: string;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}

const empty = (job: string): JobResult => ({ job, sent: 0, skipped: 0, failed: 0, errors: [] });

/** Midnight-to-midnight window `days` from today, in server local time. */
function dayWindow(days: number): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + days);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// --- Events -----------------------------------------------------------------

/**
 * Reminders at T-2 days and on the morning of.
 *
 * Optional mail: `category: "reminder"` means a member who has turned reminders
 * off in their preferences is skipped, and the footer carries an unsubscribe
 * link. The ticket itself is transactional and is not affected.
 */
export async function runEventReminders(): Promise<JobResult[]> {
  const config = await getConfig();
  if (!config.email.automated.eventReminders) {
    return [empty("event-reminder-2-days"), empty("event-reminder-same-day")];
  }

  const results: JobResult[] = [];

  for (const [days, when] of [
    [2, "2-days"],
    [0, "same-day"],
  ] as const) {
    const result = empty(`event-reminder-${when}`);
    const { start, end } = dayWindow(days);

    const events = await prisma.event.findMany({
      where: {
        date: { gte: start, lt: end },
        isPublished: true,
        status: "SCHEDULED",
      },
      include: { registrations: true },
    });

    for (const event of events) {
      if (!event.registrations.length) continue;

      const outcome = await sendMailBatch(
        event.registrations.map((registration) => ({
          to: registration.email,
          // The occasion is part of the key. Without it a member who attends
          // the same recurring event next year is silently skipped, because a
          // SENT row already exists for their registration id.
          entityId: `${registration.id}:${when}`,
          build: (ctx: any) =>
            templates.events.eventReminder(ctx, {
              name: registration.name,
              event: {
                slug: event.slug,
                title: event.title,
                date: event.date,
                startTime: event.startTime,
                endTime: event.endTime,
                location: event.location,
                address: event.address,
              },
              ticketId: registration.ticketId,
              attendees: registration.attendees,
              amountDue: registration.paymentStatus === "PAID" ? 0 : registration.pricePaid || 0,
              when,
            }),
        })),
        { template: `event.reminder.${when}`, category: "reminder", once: true }
      );

      result.sent += outcome.sent;
      result.skipped += outcome.skipped;
      result.failed += outcome.failed;
      result.errors.push(...outcome.errors);
    }

    results.push(result);
  }

  return results;
}

/** Thank-you the day after, with a link to the album if one exists. */
export async function runPostEventThankYou(): Promise<JobResult> {
  const result = empty("post-event-thank-you");
  const config = await getConfig();
  if (!config.email.automated.postEventThankYou) return result;

  const { start, end } = dayWindow(-1);

  const events = await prisma.event.findMany({
    where: { date: { gte: start, lt: end }, status: "SCHEDULED" },
    include: { registrations: true, galleryAlbum: { select: { id: true, isPublished: true } } },
  });

  for (const event of events) {
    const attended = event.registrations.filter((r) => r.isCheckedIn);
    // Fall back to everyone who registered when nobody was scanned at the
    // door — plenty of events are run without anyone working the check-in
    // screen, and thanking nobody is worse than thanking a few no-shows.
    const recipients = attended.length ? attended : event.registrations;
    if (!recipients.length) continue;

    // galleryAlbum is an array only because Prisma requires that shape for
    // the relation (see the schema comment) — there is at most one per event.
    const album = event.galleryAlbum[0];
    const galleryUrl =
      album?.isPublished && album.id ? `/gallery?album=${album.id}` : null;

    const outcome = await sendMailBatch(
      recipients.map((registration) => ({
        to: registration.email,
        entityId: registration.id,
        build: (ctx: any) =>
          templates.events.eventThankYou(ctx, {
            name: registration.name,
            event: {
              slug: event.slug,
              title: event.title,
              date: event.date,
              startTime: event.startTime,
              endTime: event.endTime,
              location: event.location,
              address: event.address,
            },
            galleryUrl,
          }),
      })),
      { template: "event.thank-you", category: "announcement", once: true }
    );

    result.sent += outcome.sent;
    result.skipped += outcome.skipped;
    result.failed += outcome.failed;
    result.errors.push(...outcome.errors);
  }

  return result;
}

// --- Membership lifecycle ---------------------------------------------------

/**
 * Renewal notices at T-30 and T-7, and the notice that a term has ended.
 *
 * Transactional rather than optional: a lapsing membership changes what
 * somebody pays at the door and whether they can vote, so it is not marketing
 * and is not suppressible.
 */
export async function runMembershipLifecycle(): Promise<JobResult[]> {
  const config = await getConfig();
  const sendingEnabled = config.email.automated.membershipLifecycle;
  const results: JobResult[] = [];

  for (const days of [30, 7] as const) {
    const result = empty(`membership-expiring-${days}`);

    // The renewal notice is purely informational — nothing to correct in the
    // database if it doesn't go out — so switched off means skip the query
    // as well as the send.
    if (!sendingEnabled) {
      results.push(result);
      continue;
    }

    const { start, end } = dayWindow(days);

    const expiring = await prisma.subscription.findMany({
      where: {
        status: SUBSCRIPTION_STATUS.ACTIVE,
        endDate: { gte: start, lt: end },
      },
      include: { user: true, plan: true },
    });

    const outcome = await sendMailBatch(
      expiring
        .filter((sub) => sub.user.email && !sub.user.anonymizedAt)
        .map((sub) => ({
          to: sub.user.email!,
          entityId: `${sub.id}:${days}`,
          build: (ctx: any) =>
            templates.membership.membershipExpiring(ctx, {
              name: sub.user.name || "there",
              planName: sub.plan.name,
              endDate: sub.endDate!,
              daysLeft: days,
              amount: sub.plan.price,
            }),
        })),
      { template: `membership.expiring-${days}`, once: true }
    );

    result.sent = outcome.sent;
    result.skipped = outcome.skipped;
    result.failed = outcome.failed;
    result.errors = outcome.errors;
    results.push(result);
  }

  // Terms that ran out yesterday. The status is corrected as well as
  // announced — a row left at ACTIVE with a past end date is what makes the
  // member list disagree with the payments ledger.
  const expiredResult = empty("membership-expired");
  const { start, end } = dayWindow(-1);

  const expired = await prisma.subscription.findMany({
    where: { status: SUBSCRIPTION_STATUS.ACTIVE, endDate: { gte: start, lt: end } },
    include: { user: true, plan: true },
  });

  // The status correction runs regardless of the toggle below — a term that
  // ran out is expired whether or not anyone is told about it.
  for (const sub of expired) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SUBSCRIPTION_STATUS.EXPIRED },
    });
  }

  if (sendingEnabled) {
    const expiredOutcome = await sendMailBatch(
      expired
        .filter((sub) => sub.user.email && !sub.user.anonymizedAt)
        .map((sub) => ({
          to: sub.user.email!,
          entityId: sub.id,
          build: (ctx: any) =>
            templates.membership.membershipExpired(ctx, {
              name: sub.user.name || "there",
              planName: sub.plan.name,
              endDate: sub.endDate!,
            }),
        })),
      { template: "membership.expired", once: true }
    );

    expiredResult.sent = expiredOutcome.sent;
    expiredResult.skipped = expiredOutcome.skipped;
    expiredResult.failed = expiredOutcome.failed;
    expiredResult.errors = expiredOutcome.errors;
  }
  results.push(expiredResult);

  return results;
}

// --- Overdue payments -------------------------------------------------------

/**
 * Membership fees whose due date has passed.
 *
 * Two notices only — at the payment term and again a fortnight later. A job
 * that mailed every overdue application daily would be indistinguishable from
 * harassment, and would train members to filter us.
 */
export async function runPaymentReminders(): Promise<JobResult> {
  const result = empty("payment-overdue");
  const config = await getConfig();
  if (!config.email.automated.paymentReminders) return result;

  const termDays = config.legal.paymentTermsDays;

  const awaiting = await prisma.subscription.findMany({
    where: { status: SUBSCRIPTION_STATUS.AWAITING_PAYMENT, paymentStatus: "PENDING" },
    include: { user: true, plan: true },
  });

  const now = Date.now();
  const due: Array<{ sub: (typeof awaiting)[number]; daysOverdue: number; finalNotice: boolean }> = [];

  for (const sub of awaiting) {
    const dueDate = paymentDueDate(sub.createdAt, termDays);
    const daysOverdue = Math.floor((now - dueDate.getTime()) / 86400000);
    // Exactly on day 0 and day 14, so the `once` guard has a stable key and a
    // job that misses a day does not fire the whole backlog at once.
    if (daysOverdue === 0) due.push({ sub, daysOverdue, finalNotice: false });
    else if (daysOverdue === 14) due.push({ sub, daysOverdue, finalNotice: true });
  }

  const outcome = await sendMailBatch(
    due
      .filter(({ sub }) => sub.user.email && !sub.user.anonymizedAt)
      .map(({ sub, daysOverdue, finalNotice }) => ({
        to: sub.user.email!,
        entityId: `${sub.id}:${finalNotice ? "final" : "first"}`,
        build: (ctx: any) =>
          templates.payments.paymentOverdue(ctx, {
            name: sub.user.name || "there",
            planName: sub.plan.name,
            amount: sub.plan.price,
            reference: sub.paymentReference || paymentReferenceFor(sub.id, sub.user.name),
            dueDate: paymentDueDate(sub.createdAt, termDays),
            daysOverdue: Math.max(daysOverdue, 1),
            finalNotice,
            bank: {
              accountHolder: config.legal.accountHolder,
              bankName: config.legal.bankName,
              iban: config.legal.iban,
              bic: config.legal.bic,
            },
          }),
      })),
    { template: "payment.overdue", once: true }
  );

  result.sent = outcome.sent;
  result.skipped = outcome.skipped;
  result.failed = outcome.failed;
  result.errors = outcome.errors;
  return result;
}

// --- Committee digest -------------------------------------------------------

export async function runAdminDigest(): Promise<JobResult> {
  const result = empty("admin-digest");
  const config = await getConfig();
  if (!config.email.automated.adminDigest) return result;

  const committee = adminEmailOrNull();
  if (!committee) {
    result.errors.push("ADMIN_EMAIL is not set");
    return result;
  }

  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const [recordedSubs, recordedRegs, outstanding, newApplications] = await Promise.all([
    prisma.subscription.findMany({
      where: { paymentStatus: "PAID", recordedAt: { gte: weekAgo } },
      include: { plan: { select: { price: true } } },
    }),
    prisma.registration.findMany({
      where: { paymentStatus: "PAID", recordedAt: { gte: weekAgo } },
      select: { pricePaid: true },
    }),
    prisma.subscription.findMany({
      where: { status: SUBSCRIPTION_STATUS.AWAITING_PAYMENT, paymentStatus: "PENDING" },
      include: { plan: { select: { price: true } } },
    }),
    prisma.subscription.count({ where: { createdAt: { gte: weekAgo } } }),
  ]);

  const recordedTotal =
    recordedSubs.reduce((sum, s) => sum + s.plan.price, 0) +
    recordedRegs.reduce((sum, r) => sum + (r.pricePaid || 0), 0);

  const overdueCutoff = Date.now();
  const overdue = outstanding.filter(
    (sub) => paymentDueDate(sub.createdAt, config.legal.paymentTermsDays).getTime() < overdueCutoff
  ).length;

  // A week with nothing in it does not need an email. The whole value of a
  // digest is that it means something when it arrives.
  if (!recordedSubs.length && !recordedRegs.length && !newApplications && !overdue) {
    result.skipped = 1;
    return result;
  }

  const sent = await sendMail({
    template: "payment.admin-digest",
    to: committee,
    entityId: `digest:${new Date().toISOString().slice(0, 10)}`,
    once: true,
    build: (ctx) =>
      templates.payments.adminPaymentDigest(ctx, {
        recorded: recordedSubs.length + recordedRegs.length,
        recordedTotal,
        outstanding: outstanding.length,
        outstandingTotal: outstanding.reduce((sum, s) => sum + s.plan.price, 0),
        overdue,
        newApplications,
      }),
  });

  if (sent.skipped) result.skipped = 1;
  else if (sent.ok) result.sent = 1;
  else {
    result.failed = 1;
    if (sent.error) result.errors.push(sent.error);
  }

  return result;
}

// --- Retention --------------------------------------------------------------

/**
 * Drop stored message bodies after 90 days.
 *
 * The log keeps the rendered HTML so an administrator can see what actually
 * went out and resend it. That HTML contains names, addresses, ticket ids and
 * bank references, so keeping it indefinitely would quietly build a second
 * copy of the membership database inside the email log. The row survives as
 * the audit trail; the personal data in it does not.
 */
export async function runEmailLogRetention(): Promise<JobResult> {
  const result = empty("email-log-retention");
  const cutoff = new Date(Date.now() - 90 * 86400000);

  const { count } = await prisma.emailLog.updateMany({
    where: { createdAt: { lt: cutoff }, html: { not: null } },
    data: { html: null },
  });

  result.sent = count;
  return result;
}
