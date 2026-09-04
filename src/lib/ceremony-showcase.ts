import { siteUrl } from "./site-url";
import type { SiteConfig } from "./config-schema";

export type QrTarget =
  | { ok: true; url: string }
  | { ok: false; reason: string };

/**
 * The address the hall's phones will be sent to.
 *
 * The draft page built this from `window.location.origin`, which is the single
 * worst place to get it: on the night that projector is plausibly on a Vercel
 * preview URL or localhost:3000, the QR encodes it silently, two hundred people
 * scan a dead link, and nobody finds out until it has already happened.
 *
 * `siteUrl()` returns undefined rather than guessing when the environment is
 * unset or local, and this honours that contract by refusing to render a code
 * at all. A missing QR is an obvious problem someone fixes in the ten minutes
 * before the ceremony. A wrong QR is an invisible one.
 */
export function qrTarget(): QrTarget {
  const url = siteUrl();

  if (!url) {
    return {
      ok: false,
      reason:
        "NEXT_PUBLIC_APP_URL is unset or points at localhost, so there is no " +
        "public address to encode. Set it to https://keralasamajam.de on the " +
        "deployment this projector is opening.",
    };
  }

  return { ok: true, url };
}

export interface CeremonyFeature {
  key: string;
  title: string;
  blurb: string;
}

/** Which module switch, if any, governs a card — mirrors the home page's `SECTION_FEATURE`. */
type FeatureSwitch = "enableGallery" | "enableMembership";

const FEATURES: (CeremonyFeature & { governedBy?: FeatureSwitch })[] = [
  {
    key: "events",
    title: "Events & registration",
    blurb: "See what's coming and reserve your seat",
  },
  {
    key: "membership",
    title: "Membership",
    blurb: "Join the Kerala Samajam family",
    governedBy: "enableMembership",
  },
  {
    key: "gallery",
    title: "Gallery",
    blurb: "Relive the moments we've shared",
    governedBy: "enableGallery",
  },
  {
    key: "about",
    title: "News & leadership",
    blurb: "Meet the committee behind KSA",
  },
];

/**
 * The feature cards to show beside the QR, minus anything switched off.
 *
 * Same instinct as the home page: there is no point putting membership on a
 * projector in front of two hundred people if the module is disabled and the
 * route 404s the moment somebody scans.
 */
export function ceremonyFeatures(config: SiteConfig): CeremonyFeature[] {
  return FEATURES.filter(
    (f) => !f.governedBy || config.features[f.governedBy]
  ).map(({ governedBy: _governedBy, ...feature }) => feature);
}
