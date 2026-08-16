/**
 * Labels for the optional-email switches.
 *
 * In its own module rather than beside the actions because a `"use server"`
 * file may only export async functions — every other export becomes a
 * build-time error. Plain data belongs outside that boundary anyway: this is
 * imported by the client component and by the unsubscribe action alike.
 */

export interface EmailPreferences {
  emailEventAnnouncements: boolean;
  emailEventReminders: boolean;
  emailNewsletter: boolean;
}

export const PREFERENCE_LABELS: Record<keyof EmailPreferences, { title: string; description: string }> = {
  emailEventAnnouncements: {
    title: "New events",
    description: "A note when we announce something new. Roughly once a month.",
  },
  emailEventReminders: {
    title: "Event reminders",
    description: "A reminder two days before an event you have registered for, and on the morning itself.",
  },
  emailNewsletter: {
    title: "Community news",
    description: "Occasional news from the committee — the general meeting, volunteering, what we have been up to.",
  },
};
