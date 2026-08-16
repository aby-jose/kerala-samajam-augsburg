"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

import { prisma } from "./prisma";
import { requireUser } from "./guards";
import { PREFERENCE_LABELS, type EmailPreferences } from "./email-preference-labels";

/**
 * Which optional email a member receives.
 *
 * Transactional mail is deliberately absent from this file. Tickets, receipts,
 * password resets, cancellation notices and GDPR responses are things a member
 * needs in order to act or has a right to receive, and offering to switch them
 * off would be offering something we cannot honour.
 */

export async function getMyEmailPreferences(): Promise<EmailPreferences> {
  const session = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      emailEventAnnouncements: true,
      emailEventReminders: true,
      emailNewsletter: true,
    },
  });

  return (
    user ?? {
      emailEventAnnouncements: true,
      emailEventReminders: true,
      emailNewsletter: true,
    }
  );
}

export async function updateMyEmailPreferences(preferences: Partial<EmailPreferences>) {
  const session = await requireUser();

  await prisma.user.update({
    where: { id: session.id },
    data: {
      emailEventAnnouncements: preferences.emailEventAnnouncements,
      emailEventReminders: preferences.emailEventReminders,
      emailNewsletter: preferences.emailNewsletter,
    },
  });

  revalidatePath("/profile");
  return { success: true };
}

/**
 * One-click unsubscribe, from a token in the footer.
 *
 * No session required, by design — Art. 7(3) GDPR asks that withdrawing be as
 * easy as consenting, and Gmail's `List-Unsubscribe-Post` handling makes the
 * request without a browser at all. The token is a 32-character nanoid tied to
 * one account and grants nothing beyond turning off one category of mail.
 */
export async function unsubscribeByToken(
  token: string,
  category?: string
): Promise<{ success: boolean; scope: string; email?: string }> {
  // `findFirst`, not `findUnique` — see the schema note on why the column is
  // indexed but not unique. A 32-character nanoid does not collide.
  const user = await prisma.user.findFirst({
    where: { unsubscribeToken: token },
    select: { id: true, email: true },
  });

  if (!user) throw new Error("This unsubscribe link is not valid. It may already have been used.");

  const field =
    category === "announcement"
      ? "emailEventAnnouncements"
      : category === "reminder"
        ? "emailEventReminders"
        : category === "newsletter"
          ? "emailNewsletter"
          : null;

  if (field) {
    await prisma.user.update({ where: { id: user.id }, data: { [field]: false } });
    return { success: true, scope: PREFERENCE_LABELS[field].title, email: user.email ?? undefined };
  }

  // No category — the link came from somewhere we cannot attribute, so treat
  // it as "stop the optional mail" rather than guessing which kind.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailEventAnnouncements: false,
      emailEventReminders: false,
      emailNewsletter: false,
    },
  });

  return { success: true, scope: "all optional email", email: user.email ?? undefined };
}

/** Re-enable everything, for the "undo" on the confirmation page. */
export async function resubscribeByToken(token: string) {
  const user = await prisma.user.findFirst({
    where: { unsubscribeToken: token },
    select: { id: true },
  });
  if (!user) throw new Error("This link is not valid.");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailEventAnnouncements: true,
      emailEventReminders: true,
      emailNewsletter: true,
    },
  });

  return { success: true };
}

/** Issue a token for a member who wants a link without waiting for an email. */
export async function ensureMyUnsubscribeToken(): Promise<string> {
  const session = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { unsubscribeToken: true },
  });

  if (user?.unsubscribeToken) return user.unsubscribeToken;

  const token = nanoid(32);
  await prisma.user.update({ where: { id: session.id }, data: { unsubscribeToken: token } });
  return token;
}
