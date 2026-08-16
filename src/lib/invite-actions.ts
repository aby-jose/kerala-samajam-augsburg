"use server";

import bcrypt from "bcrypt";

import { prisma } from "./prisma";
import { hashInviteToken, isInviteUsable } from "./rbac/invite-token";
import { BCRYPT_ROUNDS, passwordSchema } from "./password-rules";
import { sendMail, templates } from "./email";

/**
 * Every rejection collapses to one message.
 *
 * "Expired" and "not found" are different facts, and telling an
 * unauthenticated visitor which one applies reveals whether an address has
 * been invited. `isInviteUsable` hands back the distinct internal reason —
 * it must never travel further than this file.
 */
const GENERIC_INVITE_ERROR =
  "This invitation link is no longer valid. Ask the committee to send a new one.";

export async function getInviteForToken(
  token: string
): Promise<{ email: string; roleName: string } | null> {
  const invite = await prisma.staffInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { role: { select: { name: true } } },
  });

  const check = isInviteUsable(invite, new Date());
  if (!check.usable || !invite) return null;

  return { email: invite.email, roleName: invite.role.name };
}

export async function acceptInvite(token: string, password: string) {
  const check = passwordSchema.safeParse(password);
  if (!check.success) return { error: check.error.issues[0].message };

  const invite = await prisma.staffInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { role: { select: { id: true, name: true } } },
  });

  const usable = isInviteUsable(invite, new Date());
  if (!usable.usable || !invite) return { error: GENERIC_INVITE_ERROR };

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const now = new Date();

  // `passwordChangedAt` is what evicts anything already signed in as this
  // person — the jwt callback rejects tokens issued before it. An existing
  // member account is upserted, not duplicated: they keep their account and
  // gain admin access on top of it.
  const user = await prisma.user.upsert({
    where: { email: invite.email },
    create: {
      email: invite.email,
      password: hashed,
      passwordChangedAt: now,
      emailVerified: now,
      role: "ADMIN",
      staffRoleId: invite.roleId,
    },
    update: {
      password: hashed,
      passwordChangedAt: now,
      emailVerified: now,
      role: "ADMIN",
      staffRoleId: invite.roleId,
    },
  });

  // Single use. Burn every other outstanding invite for this address too, so
  // an older link cannot be replayed afterwards.
  await prisma.staffInvite.updateMany({
    where: { email: invite.email, acceptedAt: null },
    data: { acceptedAt: now },
  });

  // Not `describeAudit()`: that call is a no-op unless `requirePermission`
  // already opened a row earlier in this request, and this action is
  // reachable without a session — the invite token is the credential, so
  // there is no guard call here to have opened one. The row is written
  // directly instead.
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorEmail: invite.email,
      action: "staff.invite",
      summary: `${invite.email} accepted their invitation as ${invite.role.name}`,
      entity: "User",
      entityId: user.id,
    },
  });

  await sendMail({
    template: "account.password-changed",
    to: invite.email,
    entityId: user.id,
    build: (ctx) =>
      templates.account.passwordChanged(ctx, {
        name: user.name || "there",
        changedAt: now,
      }),
  });

  return { success: true };
}
