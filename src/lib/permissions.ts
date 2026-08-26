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
  /** Longer explanation shown from the (i) button in the roles matrix. */
  description: string;
}

export const PERMISSIONS = {
  // --- Overview ---
  "dashboard.view": {
    group: "Overview",
    label: "View the dashboard",
    mutates: false,
    description:
      "Lets someone open the admin dashboard and see its summary widgets — recent activity, key counts, and shortcuts to other sections. It doesn't grant access to any specific section; each section still checks its own view permission.",
  },

  // --- Events ---
  "events.view": {
    group: "Events",
    label: "View events",
    mutates: false,
    description:
      "Lets someone see the list of events and open an event's details, including unpublished drafts. Without this, the Events section is hidden entirely.",
  },
  "events.edit": {
    group: "Events",
    label: "Create and edit events",
    mutates: true,
    description:
      "Lets someone create new events and change an existing event's details — title, description, dates, location, pricing, images. Logged.",
  },
  "events.publish": {
    group: "Events",
    label: "Publish and unpublish events",
    mutates: true,
    description:
      "Lets someone make a draft event visible to the public, or take a published event back offline. This controls what members and visitors can actually see on the site. Logged.",
  },
  "events.delete": {
    group: "Events",
    label: "Delete events",
    mutates: true,
    description:
      "Lets someone permanently remove an event and its listing. Cannot be undone, which is why it's kept separate from ordinary editing. Logged.",
  },
  "events.cancel": {
    group: "Events",
    label: "Cancel and reinstate events",
    mutates: true,
    description:
      "Lets someone mark an event as cancelled — which notifies anyone already registered — or bring a cancelled event back. Distinct from deleting: the event record and its registrations stay intact. Logged.",
  },
  "events.announce": {
    group: "Events",
    label: "Announce an event to all members",
    mutates: true,
    description:
      "Lets someone send an email announcement about an event to every member at once. Kept separate from ordinary event editing because of how far it reaches. Logged.",
  },
  "events.ai": {
    group: "Events",
    label: "Use AI generation (incurs cost)",
    mutates: true,
    description:
      "Lets someone use the AI assistant to generate event copy. Each use calls a paid AI API, so this is restricted to control cost. Logged.",
  },

  // --- Registrations ---
  "registrations.view": {
    group: "Registrations",
    label: "View registrations",
    mutates: false,
    description:
      "Lets someone see who has registered for events and the amounts owed or paid, without being able to change anything.",
  },
  "registrations.edit": {
    group: "Registrations",
    label: "Adjust registration amounts",
    mutates: true,
    description:
      "Lets someone change the amount recorded against a registration — for example applying a discount or correcting a mistake. Logged.",
  },
  "registrations.checkin": {
    group: "Registrations",
    label: "Check attendees in",
    mutates: true,
    description: "Lets someone mark a registrant as checked in at the event door. Logged.",
  },
  "registrations.delete": {
    group: "Registrations",
    label: "Delete registrations",
    mutates: true,
    description:
      "Lets someone remove a registration entirely — for example a duplicate or a no-show that needs clearing out. Cannot be undone. Logged.",
  },

  // --- Payments ---
  "payments.view": {
    group: "Payments",
    label: "View payments",
    mutates: false,
    description:
      "Lets someone see the payment history for registrations and memberships, without recording or changing anything.",
  },
  "payments.record": {
    group: "Payments",
    label: "Record a payment",
    mutates: true,
    description:
      "Lets someone record that a payment was received — e.g. cash or an offline transfer — against a registration or membership. Logged.",
  },
  "payments.revert": {
    group: "Payments",
    label: "Reverse a recorded payment",
    mutates: true,
    description:
      "Lets someone reverse a payment that was recorded in error, putting the registration or membership back to unpaid. Kept separate from recording a payment because undoing money already accounted for is a bigger deal. Logged.",
  },

  // --- Members ---
  "members.view": {
    group: "Members",
    label: "View members",
    mutates: false,
    description: "Lets someone see the member directory and an individual member's profile details.",
  },
  "members.edit": {
    group: "Members",
    label: "Edit member details",
    mutates: true,
    description: "Lets someone change a member's profile details — contact info, address, and similar fields. Logged.",
  },
  "members.suspend": {
    group: "Members",
    label: "Suspend and reinstate members",
    mutates: true,
    description: "Lets someone suspend a member's account, blocking their access, or lift an existing suspension. Logged.",
  },
  "members.erase": {
    group: "Members",
    label: "Complete an erasure request",
    mutates: true,
    description:
      "Lets someone carry out a member's data-erasure request, permanently deleting their personal data. Cannot be undone. Logged.",
  },

  // --- Membership ---
  "membership.plans.view": {
    group: "Membership",
    label: "View plans",
    mutates: false,
    description: "Lets someone see the membership plans on offer and their pricing and terms.",
  },
  "membership.plans.edit": {
    group: "Membership",
    label: "Create and edit plans",
    mutates: true,
    description: "Lets someone create new membership plans or change existing ones — price, duration, benefits. Logged.",
  },
  "membership.plans.delete": {
    group: "Membership",
    label: "Delete plans",
    mutates: true,
    description: "Lets someone remove a membership plan so it can no longer be purchased. Logged.",
  },
  "membership.applications.view": {
    group: "Membership",
    label: "View applications",
    mutates: false,
    description: "Lets someone see incoming membership applications and their details.",
  },
  "membership.applications.approve": {
    group: "Membership",
    label: "Approve and reject applications",
    mutates: true,
    description:
      "Lets someone approve or reject a membership application — turning an applicant into a member, or declining them. Logged.",
  },
  "membership.applications.cancel": {
    group: "Membership",
    label: "Cancel a membership",
    mutates: true,
    description: "Lets someone cancel an existing membership, ending it before its natural expiry. Logged.",
  },

  // --- Gallery ---
  "gallery.view": {
    group: "Gallery",
    label: "View the gallery admin",
    mutates: false,
    description: "Lets someone open the gallery admin section and browse existing albums and media, without changing any of it.",
  },
  "gallery.albums.edit": {
    group: "Gallery",
    label: "Create and edit albums",
    mutates: true,
    description: "Lets someone create new photo or video albums, or edit an album's title, description, and cover. Logged.",
  },
  "gallery.albums.delete": {
    group: "Gallery",
    label: "Delete albums",
    mutates: true,
    description: "Lets someone permanently delete an album along with the media inside it. Cannot be undone. Logged.",
  },
  "gallery.media.upload": {
    group: "Gallery",
    label: "Publish media directly",
    mutates: true,
    description:
      "Lets someone upload photos or videos straight to the public gallery, bypassing the member-contribution review queue. Logged.",
  },
  "gallery.media.delete": {
    group: "Gallery",
    label: "Delete media",
    mutates: true,
    description: "Lets someone permanently remove a photo or video from the gallery. Cannot be undone. Logged.",
  },
  "gallery.contributions.view": {
    group: "Gallery",
    label: "View member contributions",
    mutates: false,
    description: "Lets someone see photos and videos members have submitted for the gallery, before they're approved.",
  },
  "gallery.contributions.moderate": {
    group: "Gallery",
    label: "Approve and reject contributions",
    mutates: true,
    description: "Lets someone approve a member's submitted photo or video, publishing it to the gallery, or reject it. Logged.",
  },

  // --- Reels ---
  "reels.view": {
    group: "Reels",
    label: "View synced Instagram reels",
    mutates: false,
    description: "Lets someone see the Instagram reels that have been synced into the admin, and how they're currently ordered.",
  },
  "reels.manage": {
    group: "Reels",
    label: "Feature, reorder and sync reels",
    mutates: true,
    description: "Lets someone feature a reel, reorder the list, or trigger a fresh sync from Instagram. Logged.",
  },

  // --- Content ---
  "content.home.edit": {
    group: "Content",
    label: "Edit the Home page",
    mutates: true,
    description: "Lets someone edit the text, images and sections shown on the public Home page. Logged.",
  },
  "content.about.edit": {
    group: "Content",
    label: "Edit the About page",
    mutates: true,
    description: "Lets someone edit the text and images on the public About page. Logged.",
  },
  "content.leadership.edit": {
    group: "Content",
    label: "Edit the leadership list",
    mutates: true,
    description:
      "Lets someone edit the list of leadership and committee members shown on the site — names, roles, photos, order. Logged.",
  },
  "content.pages.edit": {
    group: "Content",
    label: "Edit site pages",
    mutates: true,
    description: "Lets someone edit the content of other standalone site pages beyond Home and About. Logged.",
  },

  // --- Inquiries ---
  "inquiries.view": {
    group: "Inquiries",
    label: "Read contact messages",
    mutates: false,
    description: "Lets someone read messages submitted through the site's contact form.",
  },
  "inquiries.notify": {
    group: "Inquiries",
    label: "Receive contact form notifications by email",
    mutates: false,
    description:
      "Sends this person a copy of every new contact-form message by email as it comes in. This is a notification setting, not a viewing permission — it doesn't by itself grant access to the inquiries list in the admin.",
  },
  "inquiries.manage": {
    group: "Inquiries",
    label: "Mark messages read or archived",
    mutates: true,
    description: "Lets someone mark contact messages as read or move them to the archive. Logged.",
  },
  "inquiries.delete": {
    group: "Inquiries",
    label: "Delete messages",
    mutates: true,
    description: "Lets someone permanently delete a contact message. Cannot be undone. Logged.",
  },

  // --- Legal ---
  "legal.view": {
    group: "Legal",
    label: "View legal documents",
    mutates: false,
    description: "Lets someone see legal documents — e.g. terms and privacy policy — and their version history, without editing anything.",
  },
  "legal.edit": {
    group: "Legal",
    label: "Edit drafts",
    mutates: true,
    description: "Lets someone write and save draft changes to a legal document. Drafts aren't visible to the public until published. Logged.",
  },
  "legal.publish": {
    group: "Legal",
    label: "Publish a version",
    mutates: true,
    description: "Lets someone publish a drafted legal document, making that version the one members see and must consent to. Logged.",
  },
  "legal.consents.view": {
    group: "Legal",
    label: "View the consent register",
    mutates: false,
    description: "Lets someone see the register of which members have consented to which legal document version, and when.",
  },
  "legal.consents.export": {
    group: "Legal",
    label: "Export the consent register",
    mutates: true,
    description: "Lets someone export the consent register — typically for a compliance or audit request. Logged.",
  },

  // --- Email ---
  "email.view": {
    group: "Email",
    label: "View the email log",
    mutates: false,
    description: "Lets someone see the log of emails the system has sent — to whom, when, and whether it succeeded.",
  },
  "email.resend": {
    group: "Email",
    label: "Resend an email",
    mutates: true,
    description: "Lets someone resend an email that previously failed or needs to go out again. Logged.",
  },
  "email.test": {
    group: "Email",
    label: "Send a test email",
    mutates: true,
    description: "Lets someone send a one-off test email to check formatting and delivery, without it going to real members. Logged.",
  },

  // --- System ---
  "analytics.view": {
    group: "System",
    label: "View analytics",
    mutates: false,
    description: "Lets someone see site analytics and usage reports.",
  },
  "settings.edit": {
    group: "System",
    label: "Edit site settings",
    mutates: true,
    description: "Lets someone change site-wide settings that affect how the admin and public site behave. Logged.",
  },

  // --- Team & Access ---
  "staff.view": {
    group: "Team & Access",
    label: "View team members and invites",
    mutates: false,
    description: "Lets someone see the list of admin team members and any pending invites, without changing anything.",
  },
  "staff.invite": {
    group: "Team & Access",
    label: "Invite, resend and revoke invites",
    mutates: true,
    description: "Lets someone invite a new person to the admin team by email, resend a pending invite, or revoke one before it's accepted. Logged.",
  },
  "staff.manage": {
    group: "Team & Access",
    label: "Change roles and revoke access",
    mutates: true,
    description: "Lets someone change which role an existing team member holds, or revoke their admin access entirely. Logged.",
  },
  "roles.view": {
    group: "Team & Access",
    label: "View roles",
    mutates: false,
    description: "Lets someone see the list of roles and which permissions each one holds. This is what lets someone open this Roles page at all.",
  },
  "roles.edit": {
    group: "Team & Access",
    label: "Create and edit roles",
    mutates: true,
    description:
      "Lets someone create new roles or change which permissions an existing role grants — including, in principle, this very permission. Logged.",
  },
  "audit.view": {
    group: "Team & Access",
    label: "View the audit log",
    mutates: false,
    description: "Lets someone see the audit log — the record of who did what, and when, for every action marked as auditable across the admin panel.",
  },
} as const satisfies Record<string, PermissionMeta>;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Display order for the permission matrix. */
export const PERMISSION_GROUPS = [
  "Overview", "Events", "Registrations", "Payments", "Members", "Membership",
  "Gallery", "Reels", "Content", "Inquiries", "Legal", "Email", "System", "Team & Access",
] as const;

export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}
