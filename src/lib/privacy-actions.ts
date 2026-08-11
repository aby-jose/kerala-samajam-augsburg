"use server";

import { revalidatePath } from "next/cache";

import { NOT_REVOKED, prisma } from "./prisma";
import { requireUser } from "./guards";
import { recordConsent } from "./consent-recorder";
import { LegalSlug } from "./legal-schema";

/**
 * Data-subject rights a member can exercise themselves.
 *
 * Art. 12(2) GDPR requires the controller to *facilitate* these rights, and
 * Art. 7(3) requires withdrawing consent to be as easy as giving it. Making
 * them buttons in the profile rather than an email address is the difference
 * between complying and claiming to.
 */

async function requireUserId() {
  return (await requireUser()).id;
}

// --- Art. 15(1)(a)–(h): what has this person agreed to ------------------

export interface ConsentHistoryEntry {
  id: string;
  type: string;
  slug: LegalSlug | null;
  version: number | null;
  granted: boolean;
  source: string;
  createdAt: string;
  revokedAt: string | null;
}

export async function getMyConsentHistory(): Promise<ConsentHistoryEntry[]> {
  const userId = await requireUserId();

  const consents = await prisma.userConsent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return consents.map((c) => ({
    id: c.id,
    type: c.type,
    slug: (c.slug as LegalSlug) ?? null,
    version: c.version,
    granted: c.granted,
    source: c.source,
    createdAt: c.createdAt.toISOString(),
    revokedAt: c.revokedAt?.toISOString() ?? null,
  }));
}

// --- Art. 9(2)(a): biometric consent ------------------------------------

export async function getBiometricConsentStatus() {
  const userId = await requireUserId();

  const [latest, profile] = await Promise.all([
    prisma.userConsent.findFirst({
      where: { userId, type: "BIOMETRIC" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userFaceProfile.findUnique({ where: { userId } }),
  ]);

  return {
    granted: !!latest?.granted && !latest.revokedAt,
    grantedAt: latest?.granted && !latest.revokedAt ? latest.createdAt.toISOString() : null,
    hasStoredProfile: !!profile,
  };
}

/**
 * Explicit opt-in for biometric processing. Kept entirely separate from the
 * general document consent — bundling special-category consent with everything
 * else is exactly what supervisory authorities treat as invalid.
 */
export async function grantBiometricConsent() {
  const userId = await requireUserId();
  await recordConsent({ type: "BIOMETRIC", source: "profile", userId, granted: true });
  revalidatePath("/profile");
  return { success: true };
}

/**
 * Withdrawal under Art. 7(3). Deletes the stored face template immediately —
 * a withdrawal that leaves the biometric data in place is not a withdrawal.
 * The consent rows are marked revoked rather than deleted, because the record
 * that consent once existed is itself required evidence.
 */
export async function withdrawBiometricConsent() {
  const userId = await requireUserId();

  await prisma.userFaceProfile.deleteMany({ where: { userId } });

  await prisma.userConsent.updateMany({
    where: { userId, type: "BIOMETRIC", ...NOT_REVOKED },
    data: { revokedAt: new Date(), granted: false },
  });

  await recordConsent({ type: "BIOMETRIC", source: "profile", userId, granted: false });

  revalidatePath("/profile");
  return { success: true };
}

// --- Art. 15 / 20: access and portability -------------------------------

/**
 * Everything held about the signed-in member, as JSON.
 *
 * Deliberately excludes the password hash and the raw face descriptor: the
 * hash is a credential rather than data about the person, and re-emitting a
 * biometric template into a downloaded file would create a copy outside our
 * control. Whether a face profile exists is reported instead.
 */
export async function exportMyData() {
  const userId = await requireUserId();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Account not found");

  const [subscriptions, registrations, contributions, consents, faceProfile] =
    await Promise.all([
      prisma.subscription.findMany({
        where: { userId },
        include: { plan: { select: { name: true, price: true, duration: true } } },
      }),
      // Registrations are keyed by email rather than user id — anonymous
      // sign-ups are allowed — so they are matched the same way here, but
      // only once the address has been verified. Without that check, changing
      // the profile email to someone else's address would pull their event
      // history into this export.
      user.emailVerified && user.email
        ? prisma.registration.findMany({
            where: { email: user.email },
            include: { event: { select: { title: true, date: true, location: true } } },
          })
        : Promise.resolve([]),
      prisma.mediaContribution.findMany({
        where: { userId },
        select: {
          id: true,
          url: true,
          caption: true,
          status: true,
          createdAt: true,
          albumId: true,
        },
      }),
      prisma.userConsent.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.userFaceProfile.findUnique({ where: { userId } }),
    ]);

  // The password hash is a credential, not data about the person — it is
  // never part of an Art. 15 export.
  const profile = { ...user, password: undefined };
  delete (profile as { password?: unknown }).password;

  return {
    exportedAt: new Date().toISOString(),
    notice:
      "Personal data held about you, provided under Art. 15 and Art. 20 GDPR. " +
      "Your password hash is excluded as a credential, and your biometric " +
      "template is reported as present/absent rather than exported.",
    profile,
    subscriptions,
    eventRegistrations: registrations,
    galleryContributions: contributions,
    consents,
    biometrics: {
      faceProfileStored: !!faceProfile,
      updatedAt: faceProfile?.updatedAt?.toISOString() ?? null,
    },
  };
}

// --- Art. 17: erasure ----------------------------------------------------

export async function getDeletionRequestStatus() {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deletionRequestedAt: true, anonymizedAt: true },
  });

  return {
    requestedAt: user?.deletionRequestedAt?.toISOString() ?? null,
    anonymizedAt: user?.anonymizedAt?.toISOString() ?? null,
  };
}

/**
 * Ask for erasure.
 *
 * This flags the account rather than deleting it on the spot. Payment and
 * invoice records carry a statutory 10-year retention (§ 147 AO, § 257 HGB)
 * that overrides the erasure right, so the committee anonymises the profile
 * and keeps only what the tax rules require. What *can* go immediately goes
 * immediately: the biometric template, which rests purely on consent.
 */
export async function requestAccountDeletion() {
  const userId = await requireUserId();

  await prisma.userFaceProfile.deleteMany({ where: { userId } });

  await prisma.user.update({
    where: { id: userId },
    data: { deletionRequestedAt: new Date() },
  });

  await recordConsent({
    type: "DOCUMENT",
    source: "profile",
    userId,
    granted: false,
  });

  revalidatePath("/profile");
  return { success: true };
}

export async function cancelDeletionRequest() {
  const userId = await requireUserId();

  await prisma.user.update({
    where: { id: userId },
    data: { deletionRequestedAt: null },
  });

  revalidatePath("/profile");
  return { success: true };
}
