/** Staff access and invitations. */

import type { EmailContext } from "../layout";
import { themed } from "../layout";
import type { TemplateOutput } from "../send";
import { button, dataCard, esc, note, notice, paragraph, stack } from "../components";

export const invite = (
  ctx: EmailContext,
  data: {
    inviteLink: string;
    roleName: string;
    invitedByName: string;
    expiresHours: number;
    hasExistingAccount: boolean;
  }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `You've been invited to help run ${ctx.siteName}`,
    previewText: `Set up your ${data.roleName} access. The link expires in ${data.expiresHours} hours.`,
    eyebrow: "Invitation",
    title: "Set up your access",
    lead: `${esc(data.invitedByName)} has invited you to help run ${esc(ctx.siteName)} as ${esc(data.roleName)}. Choose a password to get started.`,
    body: stack([
      dataCard(t, {
        rows: [
          { label: "Role", value: esc(data.roleName) },
          { label: "Invited by", value: esc(data.invitedByName) },
        ],
      }),
      data.hasExistingAccount
        ? notice(t, {
            title: "You already have an account",
            body: `The password you set here replaces your current one, and works for both ${esc(ctx.siteName)} and the admin area.`,
            tone: "neutral",
          })
        : paragraph(t, "You'll be asked to choose a password, then sign in with it."),
    ]),
    action: button(t, "Set up your access", data.inviteLink),
    note: note(
      t,
      `The link expires in ${data.expiresHours} hours and can be used once. If you weren't expecting this, ignore it — nothing happens until you use the link.`
    ),
  };
};

/**
 * Sent to the person whose access changed, not the one who changed it.
 *
 * Someone quietly granting themselves or a friend a role is the failure this
 * catches: the account holder finds out either way.
 */
export const accessChanged = (
  ctx: EmailContext,
  data: { name: string; roleName: string | null; changedByName: string }
): TemplateOutput => {
  const t = themed(ctx);
  const revoked = data.roleName === null;
  return {
    subject: revoked
      ? `Your admin access to ${ctx.siteName} has been removed`
      : `Your role at ${ctx.siteName} is now ${data.roleName}`,
    previewText: revoked
      ? "Your administrator access has been removed."
      : `You are now ${data.roleName}.`,
    eyebrow: "Security",
    tone: revoked ? "warning" : "neutral",
    title: revoked ? "Admin access removed" : "Your role has changed",
    lead: revoked
      ? `${esc(data.changedByName)} has removed your administrator access. Your membership account is unaffected.`
      : `${esc(data.changedByName)} has changed your role to ${esc(data.roleName)}.`,
    body: notice(t, {
      title: "Didn't expect this?",
      body: "Reply to this email and tell the committee.",
      tone: revoked ? "warning" : "neutral",
    }),
    note: note(t, "You are receiving this because it affects your account's access."),
  };
};
