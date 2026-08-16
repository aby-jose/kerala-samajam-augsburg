"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "./prisma";
import { requirePermission } from "./guards";
import { describeAudit } from "./rbac/audit";
import { assertAssignable, LockoutError } from "./rbac/lockout";
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

export async function listStaff(): Promise<{ staff: StaffRow[]; invites: PendingInvite[] }> {
  await requirePermission("staff.view");

  const users = await prisma.user.findMany({
    where: { role: "ADMIN", staffRoleId: { not: null } },
    select: {
      id: true, name: true, email: true, createdAt: true,
      staffRole: { select: { id: true, name: true, isSystem: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const pending = await prisma.staffInvite.findMany({
    where: { acceptedAt: null, revokedAt: null, expires: { gt: new Date() } },
    include: { role: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const inviterIds = [...new Set(pending.map((i) => i.invitedById))];
  const inviters = await prisma.user.findMany({
    where: { id: { in: inviterIds } },
    select: { id: true, email: true },
  });
  const inviterEmail = new Map(inviters.map((u) => [u.id, u.email ?? "unknown"]));

  return {
    staff: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email ?? "",
      roleName: u.staffRole!.name,
      roleId: u.staffRole!.id,
      isSystem: u.staffRole!.isSystem,
      createdAt: u.createdAt,
    })),
    invites: pending.map((i) => ({
      id: i.id,
      email: i.email,
      roleName: i.role.name,
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

  const alreadyStaff = await prisma.user.findFirst({
    where: { email: normalised, role: "ADMIN", staffRoleId: { not: null } },
    select: { id: true },
  });
  if (alreadyStaff) return { error: "That person already has admin access." };

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

  const existingAccount = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true },
  });

  const raw = mintInviteToken();
  await prisma.staffInvite.create({
    data: {
      email: normalised,
      tokenHash: hashInviteToken(raw),
      roleId,
      invitedById: actor.id,
      expires: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const result = await sendMail({
    template: "staff.invite",
    to: normalised,
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

  const invite = await prisma.staffInvite.findUnique({
    where: { id: inviteId },
    include: { role: { select: { name: true } } },
  });
  if (!invite || invite.acceptedAt) return { error: "That invitation is no longer pending." };

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

  const existingAccount = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { id: true },
  });

  const result = await sendMail({
    template: "staff.invite",
    to: invite.email,
    build: (ctx) =>
      templates.staff.invite(ctx, {
        inviteLink: absoluteUrl(`/admin/invite/${raw}`),
        roleName: invite.role.name,
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

/** Counts the holders of the system role, used by the last-Super-Admin rule. */
async function superAdminCount(): Promise<number> {
  return prisma.user.count({
    where: { role: "ADMIN", staffRole: { isSystem: true } },
  });
}

export async function changeStaffRole(userId: string, roleId: string) {
  const actor = await requirePermission("staff.manage");

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, staffRole: { select: { isSystem: true } } },
    });
    if (!target) return { error: "That person is not on the staff list." };

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
      select: { id: true, name: true, email: true, staffRole: { select: { isSystem: true } } },
    });
    if (!target) return { error: "That person is not on the staff list." };

    assertAssignable({
      actorId: actor.id,
      targetId: target.id,
      targetIsSuperAdmin: target.staffRole?.isSystem ?? false,
      remainingSuperAdmins: await superAdminCount(),
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
      summary: `Removed ${target.email}'s admin access`,
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
