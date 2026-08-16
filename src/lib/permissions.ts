/**
 * Every permission the admin portal recognises.
 *
 * This is the single source of truth. Roles hold subsets of these keys; the
 * permission matrix UI renders itself from `group` and `label`; and `mutates`
 * decides whether the guard writes an audit entry, so a new mutating action
 * cannot go unlogged by omission.
 *
 * Granularity is verb-level on purpose. Recording a payment and reversing one
 * are different acts of trust, and so are editing an event and mass-mailing
 * every member about it.
 */

export interface PermissionMeta {
  group: string;
  label: string;
  /** Writes an audit entry when granted. */
  mutates: boolean;
}

export const PERMISSIONS = {
  // --- Overview ---
  "dashboard.view": { group: "Overview", label: "View the dashboard", mutates: false },

  // --- Events ---
  "events.view": { group: "Events", label: "View events", mutates: false },
  "events.edit": { group: "Events", label: "Create and edit events", mutates: true },
  "events.publish": { group: "Events", label: "Publish and unpublish events", mutates: true },
  "events.delete": { group: "Events", label: "Delete events", mutates: true },
  "events.cancel": { group: "Events", label: "Cancel and reinstate events", mutates: true },
  "events.announce": { group: "Events", label: "Announce an event to all members", mutates: true },
  "events.ai": { group: "Events", label: "Use AI generation (incurs cost)", mutates: true },

  // --- Registrations ---
  "registrations.view": { group: "Registrations", label: "View registrations", mutates: false },
  "registrations.edit": { group: "Registrations", label: "Adjust registration amounts", mutates: true },
  "registrations.checkin": { group: "Registrations", label: "Check attendees in", mutates: true },
  "registrations.delete": { group: "Registrations", label: "Delete registrations", mutates: true },

  // --- Payments ---
  "payments.view": { group: "Payments", label: "View payments", mutates: false },
  "payments.record": { group: "Payments", label: "Record a payment", mutates: true },
  "payments.revert": { group: "Payments", label: "Reverse a recorded payment", mutates: true },

  // --- Members ---
  "members.view": { group: "Members", label: "View members", mutates: false },
  "members.edit": { group: "Members", label: "Edit member details", mutates: true },
  "members.suspend": { group: "Members", label: "Suspend and reinstate members", mutates: true },
  "members.erase": { group: "Members", label: "Complete an erasure request", mutates: true },

  // --- Membership ---
  "membership.plans.view": { group: "Membership", label: "View plans", mutates: false },
  "membership.plans.edit": { group: "Membership", label: "Create and edit plans", mutates: true },
  "membership.plans.delete": { group: "Membership", label: "Delete plans", mutates: true },
  "membership.applications.view": { group: "Membership", label: "View applications", mutates: false },
  "membership.applications.approve": { group: "Membership", label: "Approve and reject applications", mutates: true },
  "membership.applications.cancel": { group: "Membership", label: "Cancel a membership", mutates: true },

  // --- Gallery ---
  "gallery.view": { group: "Gallery", label: "View the gallery admin", mutates: false },
  "gallery.albums.edit": { group: "Gallery", label: "Create and edit albums", mutates: true },
  "gallery.albums.delete": { group: "Gallery", label: "Delete albums", mutates: true },
  "gallery.media.upload": { group: "Gallery", label: "Publish media directly", mutates: true },
  "gallery.media.delete": { group: "Gallery", label: "Delete media", mutates: true },
  "gallery.contributions.view": { group: "Gallery", label: "View member contributions", mutates: false },
  "gallery.contributions.moderate": { group: "Gallery", label: "Approve and reject contributions", mutates: true },

  // --- Content ---
  "content.about.edit": { group: "Content", label: "Edit the About page", mutates: true },
  "content.leadership.edit": { group: "Content", label: "Edit the leadership list", mutates: true },

  // --- Inquiries ---
  "inquiries.view": { group: "Inquiries", label: "Read contact messages", mutates: false },
  "inquiries.manage": { group: "Inquiries", label: "Mark messages read or archived", mutates: true },
  "inquiries.delete": { group: "Inquiries", label: "Delete messages", mutates: true },

  // --- Legal ---
  "legal.view": { group: "Legal", label: "View legal documents", mutates: false },
  "legal.edit": { group: "Legal", label: "Edit drafts", mutates: true },
  "legal.publish": { group: "Legal", label: "Publish a version", mutates: true },
  "legal.consents.view": { group: "Legal", label: "View the consent register", mutates: false },
  "legal.consents.export": { group: "Legal", label: "Export the consent register", mutates: true },

  // --- Email ---
  "email.view": { group: "Email", label: "View the email log", mutates: false },
  "email.resend": { group: "Email", label: "Resend an email", mutates: true },
  "email.test": { group: "Email", label: "Send a test email", mutates: true },

  // --- System ---
  "analytics.view": { group: "System", label: "View analytics", mutates: false },
  "settings.edit": { group: "System", label: "Edit site settings", mutates: true },

  // --- Staff & Access ---
  "staff.view": { group: "Staff & Access", label: "View staff and invites", mutates: false },
  "staff.invite": { group: "Staff & Access", label: "Invite, resend and revoke invites", mutates: true },
  "staff.manage": { group: "Staff & Access", label: "Change roles and revoke access", mutates: true },
  "roles.view": { group: "Staff & Access", label: "View roles", mutates: false },
  "roles.edit": { group: "Staff & Access", label: "Create and edit roles", mutates: true },
  "audit.view": { group: "Staff & Access", label: "View the audit log", mutates: false },
} as const satisfies Record<string, PermissionMeta>;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Display order for the permission matrix. */
export const PERMISSION_GROUPS = [
  "Overview", "Events", "Registrations", "Payments", "Members", "Membership",
  "Gallery", "Content", "Inquiries", "Legal", "Email", "System", "Staff & Access",
] as const;

export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}
