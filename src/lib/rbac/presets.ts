import { ALL_PERMISSIONS, PERMISSIONS, type Permission } from "@/lib/permissions";

export interface RolePreset {
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
}

const READ_ONLY = ALL_PERMISSIONS.filter((key) => !PERMISSIONS[key].mutates);

/**
 * Starting points, not a fixed menu. The seed creates these once; the
 * committee edits them and adds their own afterwards.
 *
 * Super Admin carries an empty array deliberately — `resolvePermissions`
 * computes its set from the live catalogue, so a permission added in a later
 * release is never missing from the one role that must hold everything.
 */
export const ROLE_PRESETS: RolePreset[] = [
  {
    name: "Super Admin",
    description: "Unrestricted access, including team and role management.",
    permissions: [],
    isSystem: true,
  },
  {
    name: "Event Manager",
    description: "Runs events end to end, from listing to check-in.",
    isSystem: false,
    permissions: [
      "dashboard.view",
      "events.view", "events.edit", "events.publish", "events.delete",
      "events.cancel", "events.announce", "events.ai",
      "registrations.view", "registrations.edit", "registrations.checkin",
      "registrations.delete",
      "payments.view",
      "gallery.view", "gallery.albums.edit", "gallery.media.upload",
    ],
  },
  {
    name: "Treasurer",
    description: "Handles money: payments, invoices and membership applications.",
    isSystem: false,
    permissions: [
      "dashboard.view",
      "payments.view", "payments.record", "payments.revert",
      "membership.plans.view", "membership.plans.edit", "membership.plans.delete",
      "membership.applications.view", "membership.applications.approve",
      "membership.applications.cancel",
      "members.view", "registrations.view", "analytics.view",
    ],
  },
  {
    name: "Content Editor",
    description: "Maintains the public-facing pages and answers inquiries.",
    isSystem: false,
    permissions: [
      "dashboard.view",
      "content.home.edit", "content.about.edit", "content.leadership.edit", "content.pages.edit",
      "events.view",
      "gallery.view", "gallery.albums.edit", "gallery.media.upload",
      "legal.view",
      "inquiries.view", "inquiries.notify", "inquiries.manage",
    ],
  },
  {
    name: "Gallery Moderator",
    description: "Reviews the photos members upload after events.",
    isSystem: false,
    permissions: [
      "dashboard.view",
      "gallery.view", "gallery.albums.edit", "gallery.albums.delete",
      "gallery.media.upload", "gallery.media.delete",
      "gallery.contributions.view", "gallery.contributions.moderate",
      "events.view", "registrations.view",
    ],
  },
  {
    name: "Viewer",
    description: "Can see everything, change nothing.",
    permissions: READ_ONLY,
    isSystem: false,
  },
];
