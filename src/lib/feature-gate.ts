import { notFound } from "next/navigation";

import type { SiteConfig } from "./config-schema";
import { getConfig } from "./config-utils";
import { getAdminUser } from "./guards";

/**
 * Whether a module is switched on, and whether the site is sealed for
 * maintenance.
 *
 * These four switches existed in `SiteConfig` and on the settings screen for a
 * long time before anything read them: an administrator could turn the gallery
 * off, or throw the maintenance lever whose label promises to "lock the entire
 * public site", and nothing whatsoever would happen. This module is what makes
 * them mean something.
 *
 * Both a page gate and an action gate live here on purpose. Hiding a nav link
 * is presentation, not enforcement — a bookmark, a crawler or a hand-written
 * POST all reach the server action directly. A module that is off has to be
 * off at the point the work would actually happen.
 */

/**
 * The modules an administrator can switch off.
 *
 * `maintenanceMode` is deliberately excluded: it is not a module, it seals the
 * whole site, and it answers to `isMaintenanceLocked` instead.
 * `launchCeremony` is excluded for the opposite reason: it gates no route and
 * no action, only whether the home page listens for the operator's chord.
 */
export type FeatureKey = Exclude<
  keyof SiteConfig["features"],
  "maintenanceMode" | "launchCeremony"
>;

/**
 * What the visitor is told when a module is off.
 *
 * Vague on purpose. "Currently unavailable" covers both a deliberate switch and
 * a temporary one, and does not invite the reader to ask which — an
 * administrator turning membership off mid-season does not owe the public an
 * explanation in an error string.
 */
const FEATURE_LABELS: Record<FeatureKey, string> = {
  enableRegistration: "Event registration",
  enableGallery: "The gallery",
  enableMembership: "Membership applications",
};

export function featureDisabledMessage(key: FeatureKey): string {
  return `${FEATURE_LABELS[key]} is currently unavailable.`;
}

/**
 * Note that `getConfig` swallows a database failure and returns the defaults,
 * in which every module is on and maintenance is off. So an outage fails
 * *open* — the site stays up rather than 404ing every page because the config
 * read blipped. That is the right trade for a visibility switch; do not copy
 * the pattern to anything guarding data.
 */
export async function isFeatureEnabled(key: FeatureKey): Promise<boolean> {
  const config = await getConfig();
  return config.features[key];
}

/**
 * Page gate: renders the 404 when the module is off.
 *
 * A switched-off module simply does not exist as far as the public site is
 * concerned — no placeholder, no "coming soon", nothing to tell a visitor what
 * they are missing.
 */
export async function requireFeature(key: FeatureKey): Promise<void> {
  if (!(await isFeatureEnabled(key))) notFound();
}

/**
 * Action gate: throws when the module is off.
 *
 * Throwing rather than 404ing because the callers are server actions invoked
 * from a form the visitor is already looking at — they surface the message,
 * where `notFound()` would replace the page mid-submit.
 */
export async function assertFeature(key: FeatureKey): Promise<void> {
  if (!(await isFeatureEnabled(key))) throw new Error(featureDisabledMessage(key));
}

/**
 * Whether this viewer should see the maintenance screen instead of the site.
 *
 * Administrators are let through so they can check the site they have sealed —
 * verifying a fix during maintenance is the whole point of having the switch.
 * That check is second, and only runs once maintenance is actually on: the
 * lever is off virtually always, and every public request passes through here,
 * so reading and decrypting the admin session each time would be a cost paid
 * permanently for a rare state.
 */
export async function isMaintenanceLocked(): Promise<boolean> {
  const config = await getConfig();
  if (!config.features.maintenanceMode) return false;
  return (await getAdminUser()) === null;
}
