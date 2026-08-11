import { createHash } from "crypto";
import { headers } from "next/headers";
import { nanoid } from "nanoid";

import { prisma } from "./prisma";
import { ConsentSource, ConsentType, LegalSlug } from "./legal-schema";

/**
 * Writing consent records. Deliberately *not* a `"use server"` module.
 *
 * These are called from points where there is no session yet — signup, the
 * contact form — so they cannot be guarded by one. As exported server actions
 * they were therefore writable by anyone, and `recordDocumentConsents` took the
 * `userId` to attribute the record to. That let a stranger forge or pollute the
 * Art. 7(1) accountability trail for any member, which is precisely the
 * evidence that has to be trustworthy if it is to be worth keeping.
 *
 * Moving them out of the action surface means only server code can call them,
 * and the caller has already established who the subject is.
 */

/**
 * IPs are evidence that a consent was really given, but keeping them in the
 * clear would be collecting more than needed. A salted hash still lets us
 * show two consents came from the same origin without storing the address.
 */
export function hashIdentifier(value: string): string {
  const salt = process.env.NEXTAUTH_SECRET || "ksa-consent";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

export async function requestFingerprint() {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip");
    return {
      ipHash: ip ? hashIdentifier(ip) : null,
      userAgent: h.get("user-agent")?.slice(0, 255) || null,
    };
  } catch {
    return { ipHash: null, userAgent: null };
  }
}

export interface RecordConsentInput {
  type: ConsentType;
  source: ConsentSource;
  slug?: LegalSlug;
  version?: number;
  granted?: boolean;
  /** For anonymous subjects (contact form) — hashed before storage. */
  email?: string;
  userId?: string | null;
}

/**
 * Write one accountability record. Called from every point where a person
 * agrees to something: signup, checkout, the contact form, the re-consent
 * modal, and the Art. 9 biometric opt-in.
 */
export async function recordConsent(input: RecordConsentInput) {
  const userId = input.userId ?? null;

  const subjectKey = userId
    ? userId
    : input.email
      ? hashIdentifier(input.email.trim().toLowerCase())
      : `anon:${nanoid(12)}`;

  const { ipHash, userAgent } = await requestFingerprint();

  await prisma.userConsent.create({
    data: {
      userId,
      subjectKey,
      type: input.type,
      slug: input.slug ?? null,
      version: input.version ?? null,
      granted: input.granted ?? true,
      source: input.source,
      ipHash,
      userAgent,
    },
  });

  return { success: true };
}

/**
 * Record agreement to the current versions of the consent-bearing documents.
 * Used at signup and checkout, where the member ticks one box covering the
 * privacy policy and terms together.
 */
export async function recordDocumentConsents(
  userId: string,
  slugs: LegalSlug[],
  source: ConsentSource
) {
  const docs = await prisma.legalDocument.findMany({
    where: { slug: { in: slugs }, isPublished: true },
    select: { slug: true, version: true },
  });

  if (docs.length === 0) return { success: true, accepted: 0 };

  const { ipHash, userAgent } = await requestFingerprint();

  await prisma.userConsent.createMany({
    data: docs.map((doc) => ({
      userId,
      subjectKey: userId,
      type: "DOCUMENT",
      slug: doc.slug,
      version: doc.version,
      granted: true,
      source,
      ipHash,
      userAgent,
    })),
  });

  return { success: true, accepted: docs.length };
}

/** Consent from someone without an account — the contact form. */
export async function recordAnonymousConsent(email: string, source: ConsentSource) {
  const docs = await prisma.legalDocument.findMany({
    where: { slug: "privacy", isPublished: true },
    select: { slug: true, version: true },
  });

  const { ipHash, userAgent } = await requestFingerprint();
  const subjectKey = hashIdentifier(email.trim().toLowerCase());

  await prisma.userConsent.create({
    data: {
      userId: null,
      subjectKey,
      type: "DOCUMENT",
      slug: docs[0]?.slug ?? "privacy",
      version: docs[0]?.version ?? null,
      granted: true,
      source,
      ipHash,
      userAgent,
    },
  });

  return { success: true };
}
