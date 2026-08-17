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
  // Populated one template file at a time by the conversion tasks.
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
