"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { nanoid } from "nanoid";

import { Prisma } from "@prisma/client";

import { NOT_REVOKED, prisma } from "./prisma";
import { publicAuthOptions } from "./auth";
import { requireAdmin } from "./guards";
import { requestFingerprint } from "./consent-recorder";
import {
  COOKIE_CONSENT_MAX_AGE,
  COOKIE_CONSENT_NAME,
  COOKIE_POLICY_VERSION,
  ConsentSource,
  CookieCategories,
  LEGAL_DOCS,
  LEGAL_SLUGS,
  LegalContent,
  LegalDocumentData,
  LegalSlug,
  PendingConsent,
  StoredCookieConsent,
  asLegalContent,
  defaultCookieCategories,
  isLegalSlug,
} from "./legal-schema";

// --- Session helpers -----------------------------------------------------

/**
 * next-auth's default Session["user"] has no id or role; both are added by
 * the callbacks in auth.ts. Narrowing to this shape keeps that assumption in
 * one place instead of spreading `as any` through every call site.
 */
interface SessionUser {
  id?: string;
  email?: string | null;
  role?: string;
}

function sessionUser(session: { user?: unknown } | null): SessionUser | null {
  return (session?.user as SessionUser | undefined) ?? null;
}

async function getCurrentUser() {
  const session = await getServerSession(publicAuthOptions);
  const user = sessionUser(session);
  if (!user?.id) return null;
  return { id: user.id, email: user.email ?? null };
}

/*
 * `hashEmail` was removed: nothing called it, and as an exported action it was
 * a public oracle over `hashIdentifier`, which is keyed on NEXTAUTH_SECRET.
 * Anyone could submit an address and get back the exact `subjectKey` used for
 * anonymous consent records — enough to confirm whether a specific person had
 * ever used the contact form, given a copy of the table. `hashIdentifier` is
 * still used internally below.
 */

// --- Serialisation -------------------------------------------------------

function serializeDocument(doc: {
  slug: string;
  version: number;
  requiresConsent: boolean;
  isPublished: boolean;
  effectiveFrom: Date;
  changeNote: string | null;
  updatedAt: Date;
  de: unknown;
  en: unknown;
}): LegalDocumentData {
  return {
    slug: doc.slug as LegalSlug,
    version: doc.version,
    requiresConsent: doc.requiresConsent,
    isPublished: doc.isPublished,
    effectiveFrom: doc.effectiveFrom.toISOString(),
    changeNote: doc.changeNote,
    updatedAt: doc.updatedAt.toISOString(),
    de: asLegalContent(doc.de),
    en: asLegalContent(doc.en),
  };
}

// --- Public reads --------------------------------------------------------
//
// `getLegalDocument` was removed. The public page at /legal/[slug] reads the
// document itself — it needs the unpublished case, the seed fallback and the
// metadata in one pass — so this was a second, unused way to load the same
// row. Two sources of truth for "what does this page say" is one too many.

/** Slugs that actually exist and are published — used to build the footer. */
export async function getPublishedLegalSlugs(): Promise<LegalSlug[]> {
  const docs = await prisma.legalDocument.findMany({
    where: { isPublished: true },
    select: { slug: true },
  });
  return docs.map((d) => d.slug).filter(isLegalSlug);
}

// --- Consent records -----------------------------------------------------
//
// The writers (`recordConsent`, `recordDocumentConsents`,
// `recordAnonymousConsent`) live in `consent-recorder.ts` — a plain module,
// not an action surface. See the note there.

/**
 * Documents the signed-in member has not accepted at their current version.
 *
 * A member who accepted v1 of the privacy policy has not accepted v2 — that
 * comparison is the whole re-consent mechanism.
 */
export async function getPendingConsents(): Promise<PendingConsent[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const docs = await prisma.legalDocument.findMany({
    where: { requiresConsent: true, isPublished: true },
  });
  if (docs.length === 0) return [];

  const consents = await prisma.userConsent.findMany({
    where: {
      userId: user.id,
      type: "DOCUMENT",
      granted: true,
      slug: { in: docs.map((d) => d.slug) },
      ...NOT_REVOKED,
    },
    select: { slug: true, version: true },
  });

  const acceptedVersion = new Map<string, number>();
  for (const c of consents) {
    if (!c.slug || c.version == null) continue;
    const seen = acceptedVersion.get(c.slug) ?? 0;
    if (c.version > seen) acceptedVersion.set(c.slug, c.version);
  }

  return docs
    .filter(
      (doc) => isLegalSlug(doc.slug) && (acceptedVersion.get(doc.slug) ?? 0) < doc.version
    )
    .map((doc) => {
      const previous = acceptedVersion.get(doc.slug) ?? null;
      return {
        slug: doc.slug as LegalSlug,
        version: doc.version,
        acceptedVersion: previous,
        changeNote: doc.changeNote,
        title: {
          de: asLegalContent(doc.de).title ?? LEGAL_DOCS[doc.slug as LegalSlug].label.de,
          en: asLegalContent(doc.en).title ?? LEGAL_DOCS[doc.slug as LegalSlug].label.en,
        },
      };
    })
    .sort((a, b) => LEGAL_DOCS[a.slug].order - LEGAL_DOCS[b.slug].order);
}

/**
 * Accept a set of documents at their *current* published version. The version
 * is read server-side rather than taken from the client, so a stale tab can
 * never record agreement to a version the member was not shown.
 */
export async function acceptConsents(slugs: string[], source: ConsentSource = "reconsent") {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const valid = slugs.filter(isLegalSlug);
  if (valid.length === 0) return { success: true, accepted: 0 };

  const docs = await prisma.legalDocument.findMany({
    where: { slug: { in: valid }, isPublished: true },
    select: { slug: true, version: true },
  });

  const { ipHash, userAgent } = await requestFingerprint();

  await prisma.userConsent.createMany({
    data: docs.map((doc) => ({
      userId: user.id,
      subjectKey: user.id,
      type: "DOCUMENT",
      slug: doc.slug,
      version: doc.version,
      granted: true,
      source,
      ipHash,
      userAgent,
    })),
  });

  revalidatePath("/");
  return { success: true, accepted: docs.length };
}

// --- Cookie banner -------------------------------------------------------

export async function getCookieConsent(): Promise<StoredCookieConsent | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_CONSENT_NAME)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8")
    ) as StoredCookieConsent;

    // A newer policy version means the old choice no longer covers what we
    // set, so the banner has to be shown again.
    if (parsed.policyVersion !== COOKIE_POLICY_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCookieConsent(categories: Partial<CookieCategories>) {
  const store = await cookies();
  const existing = store.get(COOKIE_CONSENT_NAME)?.value;

  let consentId = nanoid(16);
  if (existing) {
    try {
      const parsed = JSON.parse(
        Buffer.from(existing, "base64url").toString("utf8")
      ) as StoredCookieConsent;
      if (parsed.id) consentId = parsed.id;
    } catch {
      // Corrupt cookie — a fresh id is the right recovery.
    }
  }

  const resolved: CookieCategories = {
    ...defaultCookieCategories,
    functional: categories.functional ?? false,
    media: categories.media ?? false,
    essential: true,
  };

  const payload: StoredCookieConsent = {
    id: consentId,
    categories: resolved,
    policyVersion: COOKIE_POLICY_VERSION,
    at: new Date().toISOString(),
  };

  store.set(COOKIE_CONSENT_NAME, Buffer.from(JSON.stringify(payload)).toString("base64url"), {
    maxAge: COOKIE_CONSENT_MAX_AGE,
    sameSite: "lax",
    path: "/",
    // Readable by the client so the banner can render without a round trip;
    // it holds a preference, not a credential.
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });

  const { userAgent } = await requestFingerprint();

  // Server-side mirror: the cookie proves the choice to the browser, this row
  // proves it to a supervisory authority.
  await prisma.cookieConsent.upsert({
    where: { consentId },
    update: { categories: resolved as unknown as Prisma.InputJsonValue, policyVersion: COOKIE_POLICY_VERSION, userAgent },
    create: {
      consentId,
      categories: resolved as unknown as Prisma.InputJsonValue,
      policyVersion: COOKIE_POLICY_VERSION,
      userAgent,
    },
  });

  return { success: true, consent: payload };
}

export async function withdrawCookieConsent() {
  return saveCookieConsent({ functional: false, media: false });
}

// --- Admin ---------------------------------------------------------------

export interface AdminLegalSummary {
  slug: LegalSlug;
  version: number;
  requiresConsent: boolean;
  isPublished: boolean;
  updatedAt: string;
  effectiveFrom: string;
  changeNote: string | null;
  titleDe: string;
  titleEn: string;
  sectionCount: number;
  /** Members on the current version, out of all active members. */
  coverage: { accepted: number; total: number } | null;
}

export async function adminListLegalDocuments(): Promise<AdminLegalSummary[]> {
  await requireAdmin();

  const [docs, totalMembers] = await Promise.all([
    prisma.legalDocument.findMany(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
  ]);

  const summaries = await Promise.all(
    docs.filter((d) => isLegalSlug(d.slug)).map(async (doc) => {
      let coverage: AdminLegalSummary["coverage"] = null;

      if (doc.requiresConsent) {
        const grouped = await prisma.userConsent.findMany({
          where: {
            type: "DOCUMENT",
            slug: doc.slug,
            version: doc.version,
            granted: true,
            userId: { not: null },
            ...NOT_REVOKED,
          },
          select: { userId: true },
          distinct: ["userId"],
        });
        coverage = { accepted: grouped.length, total: totalMembers };
      }

      const de = asLegalContent(doc.de);
      const en = asLegalContent(doc.en);

      return {
        slug: doc.slug as LegalSlug,
        version: doc.version,
        requiresConsent: doc.requiresConsent,
        isPublished: doc.isPublished,
        updatedAt: doc.updatedAt.toISOString(),
        effectiveFrom: doc.effectiveFrom.toISOString(),
        changeNote: doc.changeNote,
        titleDe: de?.title ?? LEGAL_DOCS[doc.slug as LegalSlug].label.de,
        titleEn: en?.title ?? LEGAL_DOCS[doc.slug as LegalSlug].label.en,
        sectionCount: de?.sections?.length ?? 0,
        coverage,
      };
    })
  );

  return summaries.sort((a, b) => LEGAL_DOCS[a.slug].order - LEGAL_DOCS[b.slug].order);
}

export async function adminGetLegalDocument(slug: string): Promise<LegalDocumentData | null> {
  await requireAdmin();
  if (!isLegalSlug(slug)) return null;

  const doc = await prisma.legalDocument.findUnique({ where: { slug } });
  return doc ? serializeDocument(doc) : null;
}

function assertContent(content: LegalContent, locale: string) {
  if (!content?.title?.trim()) {
    throw new Error(`The ${locale} title cannot be empty.`);
  }
  if (!Array.isArray(content.sections) || content.sections.length === 0) {
    throw new Error(`The ${locale} version needs at least one section.`);
  }
  for (const section of content.sections) {
    if (!section.heading?.trim()) {
      throw new Error(`Every ${locale} section needs a heading.`);
    }
  }
}

/**
 * Save wording without bumping the version. For typo fixes and clarifications
 * — nobody is re-prompted, because nothing they agreed to has changed in
 * substance. Material changes go through `adminPublishVersion` instead.
 */
export async function adminSaveDraft(
  slug: string,
  content: { de: LegalContent; en: LegalContent }
) {
  await requireAdmin();
  if (!isLegalSlug(slug)) throw new Error("Unknown document");

  assertContent(content.de, "German");
  assertContent(content.en, "English");

  await prisma.legalDocument.update({
    where: { slug },
    data: {
      de: content.de as unknown as Prisma.InputJsonValue,
      en: content.en as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/legal/${slug}`);
  revalidatePath("/admin/legal");
  return { success: true };
}

/**
 * Publish a new version.
 *
 * Snapshots the outgoing wording into LegalRevision first — that immutable
 * copy is what proves which text a member agreed to at the time. If
 * `requireReconsent` is set on a consent-bearing document, every member whose
 * latest acceptance is now behind will be prompted on their next visit.
 */
export async function adminPublishVersion(
  slug: string,
  input: {
    de: LegalContent;
    en: LegalContent;
    changeNote: string;
    requireReconsent: boolean;
  }
) {
  const admin = await requireAdmin();
  if (!isLegalSlug(slug)) throw new Error("Unknown document");

  assertContent(input.de, "German");
  assertContent(input.en, "English");

  if (!input.changeNote?.trim()) {
    throw new Error("A change note is required — members are shown it verbatim.");
  }

  const existing = await prisma.legalDocument.findUnique({ where: { slug } });
  if (!existing) throw new Error("Document not found");

  const nextVersion = existing.version + 1;

  await prisma.legalRevision.create({
    data: {
      documentId: existing.id,
      slug: existing.slug,
      version: existing.version,
      de: existing.de as Prisma.InputJsonValue,
      en: existing.en as Prisma.InputJsonValue,
      changeNote: existing.changeNote,
      publishedBy: admin.email ?? null,
    },
  });

  await prisma.legalDocument.update({
    where: { slug },
    data: {
      version: nextVersion,
      de: input.de as unknown as Prisma.InputJsonValue,
      en: input.en as unknown as Prisma.InputJsonValue,
      changeNote: input.changeNote.trim(),
      effectiveFrom: new Date(),
      // Turning this off stops future prompts but never deletes the consents
      // already recorded.
      requiresConsent: input.requireReconsent,
    },
  });

  revalidatePath(`/legal/${slug}`);
  revalidatePath("/admin/legal");
  revalidatePath("/");
  return { success: true, version: nextVersion };
}

export async function adminSetPublished(slug: string, isPublished: boolean) {
  await requireAdmin();
  if (!isLegalSlug(slug)) throw new Error("Unknown document");

  await prisma.legalDocument.update({ where: { slug }, data: { isPublished } });
  revalidatePath(`/legal/${slug}`);
  revalidatePath("/admin/legal");
  return { success: true };
}

export interface RevisionSummary {
  id: string;
  version: number;
  changeNote: string | null;
  publishedAt: string;
  publishedBy: string | null;
}

export async function adminListRevisions(slug: string): Promise<RevisionSummary[]> {
  await requireAdmin();
  if (!isLegalSlug(slug)) return [];

  const revisions = await prisma.legalRevision.findMany({
    where: { slug },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      changeNote: true,
      publishedAt: true,
      publishedBy: true,
    },
  });

  return revisions.map((r) => ({
    ...r,
    publishedAt: r.publishedAt.toISOString(),
  }));
}

export async function adminGetRevision(id: string) {
  await requireAdmin();

  const revision = await prisma.legalRevision.findUnique({ where: { id } });
  if (!revision) return null;

  return {
    id: revision.id,
    slug: revision.slug as LegalSlug,
    version: revision.version,
    changeNote: revision.changeNote,
    publishedAt: revision.publishedAt.toISOString(),
    de: asLegalContent(revision.de),
    en: asLegalContent(revision.en),
  };
}

export interface ConsentLogEntry {
  id: string;
  createdAt: string;
  type: string;
  slug: string | null;
  version: number | null;
  granted: boolean;
  source: string;
  revokedAt: string | null;
  userName: string | null;
  userEmail: string | null;
  subjectKey: string;
}

export async function adminListConsents(filter?: {
  slug?: string;
  type?: string;
  take?: number;
}): Promise<ConsentLogEntry[]> {
  await requireAdmin();

  const consents = await prisma.userConsent.findMany({
    where: {
      ...(filter?.slug && filter.slug !== "all" ? { slug: filter.slug } : {}),
      ...(filter?.type && filter.type !== "all" ? { type: filter.type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(filter?.take ?? 300, 1000),
    include: { user: { select: { name: true, email: true } } },
  });

  return consents.map((c) => ({
    id: c.id,
    createdAt: c.createdAt.toISOString(),
    type: c.type,
    slug: c.slug,
    version: c.version,
    granted: c.granted,
    source: c.source,
    revokedAt: c.revokedAt?.toISOString() ?? null,
    userName: c.user?.name ?? null,
    userEmail: c.user?.email ?? null,
    // Anonymous subjects are shown as a short hash prefix — enough to group
    // records from the same person, not enough to re-identify them.
    subjectKey: c.userId ? c.subjectKey : `${c.subjectKey.slice(0, 10)}…`,
  }));
}

/** CSV of the consent log — the evidence pack for an Art. 5(2) enquiry. */
export async function adminExportConsentsCsv(filter?: { slug?: string; type?: string }) {
  await requireAdmin();

  const rows = await adminListConsents({ ...filter, take: 1000 });
  const header = [
    "recorded_at",
    "type",
    "document",
    "version",
    "granted",
    "source",
    "revoked_at",
    "member_name",
    "member_email",
    "subject_key",
  ];

  const escape = (value: string | number | boolean | null) => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = rows.map((r) =>
    [
      r.createdAt,
      r.type,
      r.slug ?? "",
      r.version ?? "",
      r.granted,
      r.source,
      r.revokedAt ?? "",
      r.userName ?? "",
      r.userEmail ?? "",
      r.subjectKey,
    ]
      .map(escape)
      .join(",")
  );

  return { csv: [header.join(","), ...lines].join("\n"), count: rows.length };
}

/** Seed-on-demand guard for the admin list, so a fresh DB is never blank. */
export async function adminLegalDocumentCount(): Promise<number> {
  await requireAdmin();
  return prisma.legalDocument.count({ where: { slug: { in: LEGAL_SLUGS } } });
}
