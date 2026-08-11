/**
 * Shape and metadata for the site's legal documents.
 *
 * Every document exists in two locales. German is the binding version — the
 * association is registered in Germany and a German authority reading the
 * Impressum expects German — and English is the courtesy translation for the
 * membership, most of whom read the rest of the site in English.
 *
 * Bodies are stored as "markdown-lite" (see legal-render.ts): paragraphs,
 * `## ` sub-headings, `- ` bullets, `**bold**` and `[links](url)`. That is
 * deliberately less than full markdown — it is exactly the set a legal
 * document needs, it renders through the site's own typography, and it means
 * no HTML is ever stored or injected.
 */

export type LegalLocale = "de" | "en";

export type LegalSlug =
  | "imprint"
  | "privacy"
  | "terms"
  | "withdrawal"
  | "cookies"
  | "accessibility";

export interface LegalSection {
  /** Stable anchor id — used by the table of contents and deep links. */
  id: string;
  heading: string;
  /** markdown-lite; see legal-render.ts for the supported subset. */
  body: string;
}

export interface LegalContent {
  title: string;
  /** One-line lead under the page title. */
  lead: string;
  sections: LegalSection[];
}

export interface LegalDocumentData {
  slug: LegalSlug;
  version: number;
  requiresConsent: boolean;
  isPublished: boolean;
  effectiveFrom: string;
  changeNote: string | null;
  updatedAt: string;
  de: LegalContent;
  en: LegalContent;
}

export interface LegalDocMeta {
  slug: LegalSlug;
  /** Nav label per locale. The German label is the legally recognised term. */
  label: Record<LegalLocale, string>;
  /** Eyebrow shown above the page title. */
  eyebrow: Record<LegalLocale, string>;
  /** Short description for the admin list. */
  description: string;
  /** Why this document exists, shown in the admin panel. */
  basis: string;
  /** Whether a new version should re-prompt members by default. */
  requiresConsent: boolean;
  /** Order in the footer and admin list. */
  order: number;
}

/**
 * The six documents. `requiresConsent` marks the three that form the
 * contractual relationship with a member — those are the ones a member is
 * re-asked about when a new version is published. The Impressum, cookie
 * policy and accessibility statement are informational: they must be
 * accurate and reachable, but nobody "agrees" to them.
 */
export const LEGAL_DOCS: Record<LegalSlug, LegalDocMeta> = {
  imprint: {
    slug: "imprint",
    label: { de: "Impressum", en: "Imprint" },
    eyebrow: { de: "Rechtliches", en: "Legal" },
    description: "Provider identification for the association.",
    basis: "§ 5 DDG, § 18 Abs. 2 MStV — mandatory",
    requiresConsent: false,
    order: 1,
  },
  privacy: {
    slug: "privacy",
    label: { de: "Datenschutzerklärung", en: "Privacy Policy" },
    eyebrow: { de: "Datenschutz", en: "Privacy" },
    description: "How personal data is processed, and on what legal basis.",
    basis: "Art. 12–14 GDPR — mandatory",
    requiresConsent: true,
    order: 2,
  },
  terms: {
    slug: "terms",
    label: { de: "Nutzungsbedingungen", en: "Terms of Use" },
    eyebrow: { de: "Nutzung", en: "Terms" },
    description: "Rules for using the site, membership and the gallery.",
    basis: "Contractual basis for paid memberships and tickets",
    requiresConsent: true,
    order: 3,
  },
  withdrawal: {
    slug: "withdrawal",
    label: { de: "Widerrufsbelehrung", en: "Right of Withdrawal" },
    eyebrow: { de: "Widerruf", en: "Withdrawal" },
    description: "Statutory 14-day withdrawal instruction and model form.",
    basis: "§ 312g BGB, Art. 246a EGBGB — mandatory for paid memberships",
    requiresConsent: true,
    order: 4,
  },
  cookies: {
    slug: "cookies",
    label: { de: "Cookie-Richtlinie", en: "Cookie Policy" },
    eyebrow: { de: "Cookies", en: "Cookies" },
    description: "Every cookie the site sets, and why.",
    basis: "§ 25 TDDDG",
    requiresConsent: false,
    order: 5,
  },
  accessibility: {
    slug: "accessibility",
    label: { de: "Barrierefreiheit", en: "Accessibility" },
    eyebrow: { de: "Barrierefreiheit", en: "Accessibility" },
    description: "Accessibility statement and feedback channel.",
    basis: "BFSG (in force since 28 June 2025)",
    requiresConsent: false,
    order: 6,
  },
};

export const LEGAL_SLUGS = Object.keys(LEGAL_DOCS) as LegalSlug[];

export const LEGAL_DOCS_ORDERED = LEGAL_SLUGS.map((s) => LEGAL_DOCS[s]).sort(
  (a, b) => a.order - b.order
);

export function isLegalSlug(value: string): value is LegalSlug {
  return Object.prototype.hasOwnProperty.call(LEGAL_DOCS, value);
}

/**
 * Prisma types a Json column as the whole JsonValue union, which does not
 * overlap with LegalContent, so a direct cast is rejected. Narrowing happens
 * here in one place, with a shape check rather than a blind assertion — a
 * malformed row renders as an empty document instead of throwing on the
 * public page.
 */
export function asLegalContent(value: unknown): LegalContent {
  const candidate = value as Partial<LegalContent> | null;

  if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.sections)) {
    return { title: "", lead: "", sections: [] };
  }

  return {
    title: candidate.title ?? "",
    lead: candidate.lead ?? "",
    sections: candidate.sections,
  };
}

/**
 * URL aliases. German visitors and German authorities look for `/impressum`
 * and `/datenschutz`; the existing footer already links `/privacy` and
 * `/terms`. All of them resolve to the canonical `/legal/<slug>`.
 */
export const LEGAL_ALIASES: Record<string, LegalSlug> = {
  "/impressum": "imprint",
  "/imprint": "imprint",
  "/datenschutz": "privacy",
  "/privacy": "privacy",
  "/privacy-policy": "privacy",
  "/agb": "terms",
  "/terms": "terms",
  "/nutzungsbedingungen": "terms",
  "/widerruf": "withdrawal",
  "/widerrufsbelehrung": "withdrawal",
  "/cookies": "cookies",
  "/cookie-richtlinie": "cookies",
  "/barrierefreiheit": "accessibility",
  "/accessibility": "accessibility",
};

// --- Consent -------------------------------------------------------------

export type ConsentType = "DOCUMENT" | "COOKIE" | "BIOMETRIC" | "PHOTO";

export type ConsentSource =
  | "signup"
  | "reconsent"
  | "membership"
  | "registration"
  | "contact"
  | "profile"
  | "banner";

/** A document the current user has not yet accepted at its current version. */
export interface PendingConsent {
  slug: LegalSlug;
  version: number;
  /** Version the user previously accepted, if any. */
  acceptedVersion: number | null;
  changeNote: string | null;
  title: Record<LegalLocale, string>;
}

// --- Cookie categories ---------------------------------------------------

/**
 * The site runs no third-party analytics, no advertising pixels and no
 * payment SDK of any kind — payment happens by bank transfer or in cash,
 * entirely outside the browser. The honest consequence is that this list is
 * short and "essential only" is a real, fully functional choice.
 */
export interface CookieCategories {
  /** Session, CSRF and the consent record itself. Cannot be switched off. */
  essential: true;
  /** Remembered interface preferences. */
  functional: boolean;
  /** Gallery media delivered from Cloudinary (a US processor). */
  media: boolean;
}

export const defaultCookieCategories: CookieCategories = {
  essential: true,
  functional: false,
  media: false,
};

export const acceptAllCookieCategories: CookieCategories = {
  essential: true,
  functional: true,
  media: true,
};

/** Name of the first-party cookie holding the visitor's banner choice. */
export const COOKIE_CONSENT_NAME = "ksa_consent";

/** 12 months — the upper bound German authorities treat as reasonable. */
export const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Bumping this re-opens the banner for everyone. Tie it to material changes
 * in what is actually set, not to wording tweaks in the cookie policy.
 */
export const COOKIE_POLICY_VERSION = 1;

export interface StoredCookieConsent {
  id: string;
  categories: CookieCategories;
  policyVersion: number;
  at: string;
}
