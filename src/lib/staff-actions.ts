"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "./prisma";
import { requirePermission } from "./guards";
import { describeAudit } from "./rbac/audit";
import { assertAssignable, LockoutError } from "./rbac/lockout";
import { superAdminCount } from "./rbac/staff-queries";
import { INVITE_TTL_MS, hashInviteToken, mintInviteToken } from "./rbac/invite-token";
import { absoluteUrl, sendMail, templates } from "./email";
import { persistentRateLimit } from "./rate-limit";

export interface StaffRow {
  id: string;
  name: string | null;
  email: string;
  roleName: string;
  roleId: string;
  isSystem: boolean;
  createdAt: Date;
}

export interface PendingInvite {
  id: string;
  email: string;
  roleName: string;
  expires: Date;
  invitedByEmail: string;
}

/**
 * Strips the raw invite token out of the copy written to `EmailLog.html`.
 *
 * `getEmailHtml` (`email-admin-actions.ts`) lets anyone holding `email.view`
 * — including the seeded Viewer preset, which holds every non-mutating key —
 * read a stored message back. Left in, the link in that stored copy is a
 * live credential for whatever role was invited, readable by staff nowhere
 * near trusted enough to invite anyone, unattributably (the audit row names
 * the invitee, not whoever opened the log), and for up to the log's 90-day
 * retention — well past the token's own 72-hour life. The delivered copy is
 * untouched; only the inspectable record loses the credential.
 */
function redactInviteLink(html: string, rawToken: string): string {
  return html.split(rawToken).join("[invite link — token withheld from the stored copy]");
}

/** A user row that currently holds a live staff grant. */
function isStaffMember(user: { role: string; staffRoleId: string | null }): boolean {
  return user.role === "ADMIN" && user.staffRoleId !== null;
}

export async function listStaff(): Promise<{ staff: StaffRow[]; invites: PendingInvite[] }> {
  await requirePermission("staff.view");

  const users = await prisma.user.findMany({
    where: { role: "ADMIN", staffRoleId: { not: null } },
    select: {
      id: true, name: true, email: true, createdAt: true, staffRoleId: true,
      staffRole: { select: { id: true, name: true, isSystem: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // `role` is a required relation on `StaffInvite` — Prisma throws rather
  // than returning null for a row whose `roleId` no longer resolves (see
  // `deleteRole`'s comment: it stops *new* orphans, not rows that predate
  // the guard, or ones a role got removed from by some other path). An
  // `include` here would take the whole staff screen down over one bad row,
  // so the role is fetched separately below and joined by hand, the same
  // way `inviterEmail` already is.
  const pending = await prisma.staffInvite.findMany({
    where: { acceptedAt: null, revokedAt: null, expires: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  const inviterIds = [...new Set(pending.map((i) => i.invitedById))];
  const inviters = await prisma.user.findMany({
    where: { id: { in: inviterIds } },
    select: { id: true, email: true },
  });
  const inviterEmail = new Map(inviters.map((u) => [u.id, u.email ?? "unknown"]));

  const roleIds = [...new Set(pending.map((i) => i.roleId))];
  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds } },
    select: { id: true, name: true },
  });
  const roleNameById = new Map(roles.map((r) => [r.id, r.name]));

  return {
    staff: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email ?? "",
      // `staffRole` is an *optional* relation, so an orphan resolves to
      // `null` rather than throwing here — but the `where` above already
      // filters `staffRoleId: { not: null }`, and `deleteRole` refuses to
      // delete a role any user still holds, so this fallback is not expected
      // to be exercised today. It's here so a future change to either guard
      // degrades this row instead of crashing the map on a bare `!`.
      roleName: u.staffRole?.name ?? "(role deleted)",
      roleId: u.staffRole?.id ?? u.staffRoleId ?? "",
      isSystem: u.staffRole?.isSystem ?? false,
      createdAt: u.createdAt,
    })),
    invites: pending.map((i) => ({
      id: i.id,
      email: i.email,
      // Shown, not omitted: an invite pointing at a deleted role is exactly
      // what an administrator needs to see so they can revoke it — dropping
      // the row would leave a live invite nobody could find or clear.
      roleName: roleNameById.get(i.roleId) ?? "(role deleted)",
      expires: i.expires,
      invitedByEmail: inviterEmail.get(i.invitedById) ?? "unknown",
    })),
  };
}

export async function inviteStaff(email: string, roleId: string) {
  const actor = await requirePermission("staff.invite");

  const normalised = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
    return { error: "That doesn't look like an email address." };
  }

  // Invites send mail to an address the recipient did not choose to hear from,
  // so the rate is capped per inviter rather than per target.
  const { ok } = await persistentRateLimit(`invite:${actor.id}`, 20, 60 * 60 * 1000);
  if (!ok) return { error: "Too many invitations sent. Try again in an hour." };

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return { error: "Pick a role for this person." };

  // Case-insensitive: MongoDB's unique index on `email` is case-sensitive but
  // `registerUser` stores addresses exactly as typed, so "Foo@Example.com"
  // and "foo@example.com" are the same account to a person even though they
  // are two different index entries. `acceptInvite` matches the same way —
  // see the identical lookup there — so the two stay in agreement about
  // which account this invite belongs to.
  const existingAccount = await prisma.user.findFirst({
    where: { email: { equals: normalised, mode: "insensitive" } },
    select: { id: true, role: true, staffRoleId: true },
  });

  if (existingAccount && isStaffMember(existingAccount)) {
    return { error: "That person already has admin access." };
  }

  // A suspension is a deliberate decision this must not quietly reverse:
  // `acceptInvite` sets `role: "ADMIN"` unconditionally, which would clear a
  // `SUSPENDED_ADMIN` / `SUSPENDED_MEMBER` the moment the invite is accepted.
  if (existingAccount?.role.startsWith("SUSPENDED_")) {
    return {
      error: "This person's account is suspended. Lift the suspension before inviting them.",
    };
  }

  const outstanding = await prisma.staffInvite.findFirst({
    where: {
      email: normalised,
      acceptedAt: null,
      revokedAt: null,
      expires: { gt: new Date() },
    },
  });
  if (outstanding) {
    return { error: "An invitation is already pending for that address. Resend it instead." };
  }

  const raw = mintInviteToken();
  await prisma.staffInvite.create({
    data: {
      email: normalised,
      tokenHash: hashInviteToken(raw),
      roleId,
      invitedById: actor.id,
      expires: new Date(Date.now() + INVITE_TTL_MS),
      // Written explicitly, not left to the schema default: MongoDB has no
      // column default, so a field `create()` never mentions is left
      // entirely absent from the document rather than stored as `null`.
      // `listStaff`'s pending-invites query (and the "already pending"
      // duplicate check above) filter on `acceptedAt: null, revokedAt:
      // null` — Prisma's Mongo connector compiles that into "field is
      // present AND equals null", which an absent field fails. Without
      // this, every new invite was invisible to both queries.
      acceptedAt: null,
      revokedAt: null,
    },
  });

  const result = await sendMail({
    template: "staff.invite",
    to: normalised,
    redactForStorage: (html) => redactInviteLink(html, raw),
    build: (ctx) =>
      templates.staff.invite(ctx, {
        inviteLink: absoluteUrl(`/admin/invite/${raw}`),
        roleName: role.name,
        invitedByName: actor.name ?? actor.email,
        expiresHours: INVITE_TTL_MS / (60 * 60 * 1000),
        hasExistingAccount: Boolean(existingAccount),
      }),
  });

  if (!result.ok) {
    return { error: "Could not send the invitation. Check the email log." };
  }

  await describeAudit({
    summary: `Invited ${normalised} as ${role.name}`,
    entity: "StaffInvite",
    metadata: { email: normalised, roleName: role.name },
  });

  revalidatePath("/admin/staff");
  return { success: true };
}

export async function resendInvite(inviteId: string) {
  const actor = await requirePermission("staff.invite");

  const invite = await prisma.staffInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.acceptedAt) return { error: "That invitation is no longer pending." };

  // `role` is a required relation, so an `include` on the query above would
  // throw rather than return null for a row whose role has since been
  // deleted — see the matching comment in `listStaff`. Fetched separately so
  // that case reaches the actor as an ordinary `{ error }`, not an unhandled
  // exception, and checked before the rate limit below so a permanently
  // broken invite doesn't spend the actor's sending budget on every retry.
  const role = await prisma.role.findUnique({
    where: { id: invite.roleId },
    select: { name: true },
  });
  if (!role) {
    return {
      error: "The role this invitation was for no longer exists. Revoke it and issue a fresh one.",
    };
  }

  // Same cap as inviteStaff, and for the same reason — this mails an address
  // that did not choose to hear from us, and shares the inviter's budget so
  // resending cannot be used to double it.
  const { ok } = await persistentRateLimit(`invite:${actor.id}`, 20, 60 * 60 * 1000);
  if (!ok) return { error: "Too many invitations sent. Try again in an hour." };

  const existingAccount = await prisma.user.findFirst({
    where: { email: { equals: invite.email, mode: "insensitive" } },
    select: { id: true, role: true },
  });

  if (existingAccount?.role.startsWith("SUSPENDED_")) {
    return {
      error: "This person's account is suspended. Lift the suspension before inviting them.",
    };
  }

  // A fresh token replaces the old one, so a link sitting in an inbox from the
  // first email stops working the moment this is sent.
  const raw = mintInviteToken();
  await prisma.staffInvite.update({
    where: { id: inviteId },
    data: {
      tokenHash: hashInviteToken(raw),
      expires: new Date(Date.now() + INVITE_TTL_MS),
      revokedAt: null,
    },
  });

  const result = await sendMail({
    template: "staff.invite",
    to: invite.email,
    redactForStorage: (html) => redactInviteLink(html, raw),
    build: (ctx) =>
      templates.staff.invite(ctx, {
        inviteLink: absoluteUrl(`/admin/invite/${raw}`),
        roleName: role.name,
        invitedByName: actor.name ?? actor.email,
        expiresHours: INVITE_TTL_MS / (60 * 60 * 1000),
        hasExistingAccount: Boolean(existingAccount),
      }),
  });
  if (!result.ok) return { error: "Could not send the invitation." };

  await describeAudit({
    summary: `Resent the invitation to ${invite.email}`,
    entity: "StaffInvite",
    entityId: inviteId,
  });

  revalidatePath("/admin/staff");
  return { success: true };
}

export async function revokeInvite(inviteId: string) {
  await requirePermission("staff.invite");

  const invite = await prisma.staffInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return { error: "Invitation not found." };

  await prisma.staffInvite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date() },
  });

  await describeAudit({
    summary: `Revoked the invitation to ${invite.email}`,
    entity: "StaffInvite",
    entityId: inviteId,
  });

  revalidatePath("/admin/staff");
  return { success: true };
}

export async function changeStaffRole(userId: string, roleId: string) {
  const actor = await requirePermission("staff.manage");

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, role: true, staffRoleId: true,
        staffRole: { select: { isSystem: true } },
      },
    });
    if (!target || !isStaffMember(target)) {
      return { error: "That person is not on the team." };
    }

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return { error: "Pick a role." };

    assertAssignable({
      actorId: actor.id,
      targetId: target.id,
      targetIsSuperAdmin: target.staffRole?.isSystem ?? false,
      remainingSuperAdmins: await superAdminCount(),
    });

    await prisma.user.update({ where: { id: userId }, data: { staffRoleId: roleId } });

    await sendMail({
      template: "staff.access-changed",
      to: target.email ?? "",
      entityId: target.id,
      build: (ctx) =>
        templates.staff.accessChanged(ctx, {
          name: target.name ?? "there",
          roleName: role.name,
          changedByName: actor.name ?? actor.email,
        }),
    });

    await describeAudit({
      summary: `Changed ${target.email}'s role to ${role.name}`,
      entity: "User",
      entityId: target.id,
      metadata: { roleName: role.name },
    });

    revalidatePath("/admin/staff");
    return { success: true };
  } catch (error) {
    if (error instanceof LockoutError) return { error: error.message };
    console.error("changeStaffRole failed", error);
    return { error: "Could not change the role." };
  }
}

export async function revokeStaffAccess(userId: string) {
  const actor = await requirePermission("staff.manage");

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, role: true, staffRoleId: true,
        staffRole: { select: { isSystem: true } },
      },
    });
    if (!target || !isStaffMember(target)) {
      return { error: "That person is not on the team." };
    }

    assertAssignable({
      actorId: actor.id,
      targetId: target.id,
      targetIsSuperAdmin: target.staffRole?.isSystem ?? false,
      remainingSuperAdmins: await superAdminCount(),
    });

    // An administrator removed for cause could otherwise have mailed
    // themselves (or an accomplice) an invitation minutes earlier and
    // accepted it after losing access. Any invite they issued that is still
    // outstanding is burned in the same stroke.
    //
    // Done before the demotion below, not after: if this throws, the target
    // is still staff and a retry re-enters this function normally. The other
    // order would let a failure here strand the demotion — a retry would
    // find someone the `isStaffMember` check above now refuses outright, so
    // those invites could never be revoked through this action again.
    const revoked = await prisma.staffInvite.updateMany({
      where: { invitedById: userId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // The membership account survives — only the admin grant is withdrawn.
    await prisma.user.update({
      where: { id: userId },
      data: { role: "MEMBER", staffRoleId: null },
    });

    await sendMail({
      template: "staff.access-changed",
      to: target.email ?? "",
      entityId: target.id,
      build: (ctx) =>
        templates.staff.accessChanged(ctx, {
          name: target.name ?? "there",
          roleName: null,
          changedByName: actor.name ?? actor.email,
        }),
    });

    await describeAudit({
      summary:
        `Removed ${target.email}'s admin access` +
        (revoked.count > 0
          ? ` and revoked ${revoked.count} pending invitation${revoked.count === 1 ? "" : "s"} they had sent`
          : ""),
      entity: "User",
      entityId: target.id,
    });

    revalidatePath("/admin/staff");
    return { success: true };
  } catch (error) {
    if (error instanceof LockoutError) return { error: error.message };
    console.error("revokeStaffAccess failed", error);
    return { error: "Could not remove access." };
  }
}
