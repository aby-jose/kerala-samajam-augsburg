"use server";

import { revalidatePath } from "next/cache";

import { NOT_REVOKED, prisma } from "./prisma";
import { requirePermission, requireUser } from "./guards";
import { recordConsent } from "./consent-recorder";
import { LegalSlug } from "./legal-schema";
import { sendMail, templates } from "./email";
import { adminEmailOrNull } from "./admin-contact";
import { SUBSCRIPTION_STATUS } from "./membership-term";
import { deleteFromCloudinary } from "./cloudinary";

/**
 * Art. 12(3) GDPR gives the controller one month to act on a data-subject
 * request. Naming the date in the acknowledgement is both a courtesy to the
 * member and the committee's own clock.
 */
const RESPONSE_DEADLINE_DAYS = 30;

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

  // Confirm the request in writing. Art. 15 is a request the member is
  // entitled to have answered, and an answer that exists only as a file the
  // browser downloaded leaves the association with no record it responded.
  //
  // The export itself is deliberately not attached: a complete copy of
  // somebody's personal data does not belong in an unencrypted mailbox.
  if (user.email) {
    await sendMail({
      template: "privacy.data-export-ready",
      to: user.email,
      entityId: user.id,
      build: (ctx) =>
        templates.privacy.dataExportReady(ctx, {
          name: user.name || "there",
          requestedAt: new Date(),
        }),
    });
  }

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
  const user = await requireUser();
  const userId = user.id;

  await prisma.userFaceProfile.deleteMany({ where: { userId } });

  const requestedAt = new Date();
  const deadline = new Date(requestedAt.getTime() + RESPONSE_DEADLINE_DAYS * 86400000);

  await prisma.user.update({
    where: { id: userId },
    data: { deletionRequestedAt: requestedAt },
  });

  await recordConsent({
    type: "DOCUMENT",
    source: "profile",
    userId,
    granted: false,
  });

  // Acknowledge it, and put it in front of somebody who can act.
  //
  // Neither happened before: the request set a flag on a row and nothing else
  // in the system knew. A member had no confirmation their request had landed,
  // and the committee had no way to learn of it short of noticing the column —
  // which is not a defence when the month runs out.
  if (user.email) {
    await sendMail({
      template: "privacy.deletion-requested",
      to: user.email,
      entityId: userId,
      build: (ctx) =>
        templates.privacy.deletionRequested(ctx, {
          name: user.name || "there",
          requestedAt,
          deadline,
        }),
    });
  }

  const committee = adminEmailOrNull();
  if (committee) {
    const activeMembership = await prisma.subscription.findFirst({
      where: { userId, status: SUBSCRIPTION_STATUS.ACTIVE, endDate: { gte: new Date() } },
      select: { id: true },
    });

    await sendMail({
      template: "privacy.deletion-admin-notice",
      to: committee,
      entityId: userId,
      build: (ctx) =>
        templates.privacy.deletionAdminNotice(ctx, {
          memberName: user.name || "A member",
          memberEmail: user.email || "unknown",
          requestedAt,
          deadline,
          hasActiveMembership: !!activeMembership,
        }),
    });
  }

  revalidatePath("/profile");
  return { success: true };
}

export async function cancelDeletionRequest() {
  const user = await requireUser();

  await prisma.user.update({
    where: { id: user.id },
    data: { deletionRequestedAt: null },
  });

  if (user.email) {
    await sendMail({
      template: "privacy.deletion-cancelled",
      to: user.email,
      entityId: user.id,
      build: (ctx) => templates.privacy.deletionCancelled(ctx, { name: user.name || "there" }),
    });
  }

  revalidatePath("/profile");
  return { success: true };
}

// --- Art. 17: carrying the erasure out -----------------------------------

/**
 * Actually erase a member, and tell them it is done.
 *
 * The request side of this existed and the execution side did not: a member
 * could ask, a column was set, and nothing in the system could complete it.
 * The right is not "the ability to submit a request", so this is the other
 * half.
 *
 * Anonymisation rather than deletion, because payment and invoice rows carry a
 * ten-year statutory retention under § 147 AO and § 257 HGB which Art. 17(3)(b)
 * preserves. Everything that points at a person is removed; the financial
 * skeleton stays and no longer identifies anyone.
 */
export async function completeAccountDeletion(userId: string) {
  const admin = await requirePermission("members.erase");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Account not found");
  if (user.anonymizedAt) throw new Error("This account has already been anonymised.");
  if (!user.deletionRequestedAt) {
    throw new Error("This member has not requested erasure. Do not anonymise an account on a whim.");
  }

  const completedAt = new Date();
  const originalEmail = user.email;
  const originalName = user.name;

  // Sent *before* the address is cleared — afterwards there is nowhere left to
  // send it, and a member is entitled to be told the thing they asked for was
  // done. This is the last message this person will ever receive from us.
  if (originalEmail) {
    await sendMail({
      template: "privacy.deletion-completed",
      to: originalEmail,
      entityId: userId,
      build: (ctx) =>
        templates.privacy.deletionCompleted(ctx, {
          name: originalName || "there",
          completedAt,
        }),
    });
  }

  // Event registrations are keyed by email string rather than user id, so they
  // would otherwise survive the erasure carrying the member's name, address
  // and phone number.
  if (originalEmail) {
    const registrations = await prisma.registration.findMany({
      where: { email: originalEmail },
      select: { id: true },
    });
    for (const registration of registrations) {
      await prisma.registration.update({
        where: { id: registration.id },
        data: {
          name: "Erased",
          email: `erased+${registration.id}@invalid.local`,
          phone: null,
        },
      });
    }
  }

  await prisma.userFaceProfile.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });

  // The avatar is nulled on the row below, same as every other identifying
  // field here — but nulling the column was never enough on its own (see the
  // identical gap `deleteAlbum` closed for gallery photos): the image itself
  // stays live on Cloudinary at its old URL unless it's actually removed.
  // Best-effort and safe to call unconditionally — `image` may also be an
  // OAuth provider's own profile picture URL rather than a Cloudinary one
  // (never uploaded through `updateAvatar`), which this simply can't parse
  // a public_id from and skips.
  if (user.image) await deleteFromCloudinary(user.image);

  // A scanned student ID normally doesn't outlive its own review —
  // `approveMembership`/`rejectMembership` purge it the moment a decision is
  // made — but an application still sitting unreviewed at the moment someone
  // is erased would otherwise leave that document behind indefinitely, tied
  // to a row that no longer identifies anyone but still points at a real
  // Cloudinary asset. Subscription rows themselves are financial records
  // under statutory retention (see this function's own doc comment) and stay,
  // so only the document is removed, not the row.
  const subsWithStudentId = await prisma.subscription.findMany({
    where: { userId },
    select: { id: true, details: true },
  });
  for (const sub of subsWithStudentId) {
    const { studentIdUrl, ...restDetails } = (sub.details as any) || {};
    if (typeof studentIdUrl !== "string") continue;
    await deleteFromCloudinary(studentIdUrl);
    await prisma.subscription.update({ where: { id: sub.id }, data: { details: restDetails } });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: "Erased member",
      // Unique index, so it cannot simply be nulled for every erased account.
      email: `erased+${userId}@invalid.local`,
      password: null,
      phone: null,
      address: null,
      city: null,
      zip: null,
      dob: null,
      occupation: null,
      bio: null,
      image: null,
      emailVerified: null,
      status: "DEACTIVATED",
      anonymizedAt: completedAt,
      unsubscribeToken: null,
    },
  });

  console.info(
    `[gdpr] Account ${userId} anonymised by ${admin.email || admin.id} at ${completedAt.toISOString()}`
  );

  revalidatePath("/admin/members");
  return { success: true };
}
