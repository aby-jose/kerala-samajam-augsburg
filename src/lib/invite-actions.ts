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
  try {
    const invite = await prisma.staffInvite.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      include: { role: { select: { name: true } } },
    });

    const check = isInviteUsable(invite, new Date());
    if (!check.usable || !invite) return null;

    return { email: invite.email, roleName: invite.role.name };
  } catch (error) {
    // `role` is a required relation: if the role behind this invite was ever
    // deleted (it shouldn't be reachable now that `deleteRole` refuses a role
    // with pending invites, but this page is unauthenticated and must not
    // depend on that holding for every row that predates the guard), Prisma
    // throws rather than returning a null relation. Whoever is looking at
    // this link cannot tell that apart from any other bad token, so it
    // collapses into the same generic answer instead of a 500.
    console.error("getInviteForToken failed", error);
    return null;
  }
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
  // member account is updated in place, not duplicated: they keep their
  // account and gain admin access on top of it.
  //
  // The match is case-insensitive on purpose, and deliberately not a plain
  // `upsert` keyed on `invite.email`. `registerUser` stores addresses exactly
  // as typed, MongoDB's unique index on `email` is case-sensitive, and
  // `inviteStaff` normalises to lower case before storing the invite — so an
  // invite to "Foo@Example.com" and an existing "foo@example.com" account are
  // the same person but two different index entries. An `upsert` keyed on the
  // lower-cased address would miss that account and create a second one,
  // orphaning the first one's history and falsifying the invite email's
  // promise that the new password "works for both". Finding the account
  // first and updating it by id avoids that regardless of which casing it was
  // originally created with.
  const existingAccount = await prisma.user.findFirst({
    where: { email: { equals: invite.email, mode: "insensitive" } },
  });

  const user = existingAccount
    ? await prisma.user.update({
        where: { id: existingAccount.id },
        data: {
          password: hashed,
          passwordChangedAt: now,
          emailVerified: now,
          role: "ADMIN",
          staffRoleId: invite.roleId,
        },
      })
    : await prisma.user.create({
        data: {
          email: invite.email,
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
