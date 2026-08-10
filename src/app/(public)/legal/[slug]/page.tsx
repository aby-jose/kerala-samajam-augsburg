import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/config-utils";
import { getSeedFor } from "@/lib/legal-content";
import { buildPlaceholderMap, resolveContent, toPlainText } from "@/lib/legal-render";
import {
  LEGAL_DOCS,
  LEGAL_DOCS_ORDERED,
  LEGAL_SLUGS,
  LegalSlug,
  asLegalContent,
  isLegalSlug,
} from "@/lib/legal-schema";
import { LegalDocumentClient } from "./legal-document-client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

/**
 * Load a document, falling back to the shipped default wording.
 *
 * The footer links to these pages, and a legally mandatory page must never
 * 404 because a seed step was missed on deploy. If the database has no row
 * yet the bundled default is served, and the admin panel takes over the
 * moment the document is seeded.
 */
async function loadDocument(slug: LegalSlug) {
  try {
    const doc = await prisma.legalDocument.findUnique({ where: { slug } });
    if (doc && doc.isPublished) {
      return {
        de: asLegalContent(doc.de),
        en: asLegalContent(doc.en),
        version: doc.version,
        effectiveFrom: doc.effectiveFrom.toISOString(),
        requiresConsent: doc.requiresConsent,
      };
    }
    if (doc && !doc.isPublished) return null;
  } catch (error) {
    console.error(`Failed to load legal document "${slug}":`, error);
  }

  const seed = getSeedFor(slug);
  if (!seed) return null;

  return {
    de: seed.de,
    en: seed.en,
    version: 1,
    effectiveFrom: new Date().toISOString(),
    requiresConsent: seed.requiresConsent,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isLegalSlug(slug)) return {};

  const [doc, config] = await Promise.all([loadDocument(slug), getConfig()]);
  if (!doc) return {};

  const map = buildPlaceholderMap(config);
  const en = resolveContent(doc.en, map);

  return {
    title: `${en.title} | ${config.siteName}`,
    description: toPlainText(en.lead || en.sections[0]?.body || ""),
    alternates: { canonical: `/legal/${slug}` },
    // Legal pages carry no SEO value and change with every version; keeping
    // them out of the index avoids stale wording ranking above the live page.
    robots: { index: false, follow: true },
  };
}

export default async function LegalPage({ params }: PageProps) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();

  const [doc, config] = await Promise.all([loadDocument(slug), getConfig()]);
  if (!doc) notFound();

  const map = buildPlaceholderMap(config);

  return (
    <LegalDocumentClient
      meta={LEGAL_DOCS[slug]}
      content={{
        de: resolveContent(doc.de, map),
        en: resolveContent(doc.en, map),
      }}
      version={doc.version}
      effectiveFrom={doc.effectiveFrom}
      requiresConsent={doc.requiresConsent}
      siblings={LEGAL_DOCS_ORDERED.filter((d) => d.slug !== slug).map((d) => ({
        slug: d.slug,
        label: d.label,
      }))}
    />
  );
}
