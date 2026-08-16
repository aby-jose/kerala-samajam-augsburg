/** Account and security email. */

import type { EmailContext } from "../layout";
import { themed } from "../layout";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import {
  bulletList,
  button,
  codeBlock,
  dataCard,
  esc,
  note,
  notice,
  paragraph,
  stack,
  strong,
} from "../components";

export const verifyEmail = (ctx: EmailContext, data: { verifyLink: string }): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Verify your email — ${ctx.siteName}`,
    previewText: "One click and your account is ready. The link is good for 24 hours.",
    eyebrow: "Confirm your account",
    title: "Confirm your email address",
    lead: `Welcome to ${esc(ctx.siteName)}. Confirm this address and your member portal is ready to use.`,
    action: button(t, "Verify my email", data.verifyLink),
    note: note(
      t,
      "This link expires in 24 hours. If you did not create an account you can ignore this message — nothing happens without the confirmation."
    ),
  };
};

export const welcome = (ctx: EmailContext, data: { name: string }): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Welcome to ${ctx.siteName}`,
    previewText: "Your account is active. Here is what you can do with it.",
    eyebrow: "Welcome",
    title: `Namaskaram, ${data.name}`,
    lead: "Your email is confirmed and your account is active. You are now part of the community.",
    body: bulletList(t, [
      `${strong(t, "Book events")} — register for gatherings, festivals and socials.`,
      `${strong(t, "Become a member")} — members pay less at events and can vote at the general meeting.`,
      `${strong(t, "Share photographs")} — contribute your pictures to the community albums.`,
    ]),
    action: button(t, "Explore upcoming events", absoluteUrl("/events")),
    note: note(t, "Questions at any point? Reply to this email and a person will read it."),
  };
};

export const otpCode = (ctx: EmailContext, data: { code: string }): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `${data.code} is your verification code`,
    previewText: `Your code is ${data.code}. It expires in 10 minutes.`,
    eyebrow: "Verification code",
    title: "Your code is below",
    lead: "Enter this code to continue with your membership application. It is valid for 10 minutes.",
    body: codeBlock(t, data.code),
    note: note(
      t,
      "If you did not ask for this code, someone may have typed your address by mistake. You can ignore this message."
    ),
  };
};

export const passwordReset = (ctx: EmailContext, data: { resetLink: string }): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Reset your password — ${ctx.siteName}`,
    previewText: "A link to set a new password. It expires in one hour.",
    eyebrow: "Security",
    title: "Set a new password",
    lead: "We received a request to reset the password for your account. Use the button below to choose a new one.",
    body: notice(t, {
      title: "Didn't request this?",
      body: "Then no action is needed — your password has not changed. If you keep receiving these, reply and tell us.",
      tone: "neutral",
    }),
    action: button(t, "Choose a new password", data.resetLink),
    note: note(t, "The link expires in one hour and can be used once."),
  };
};

/**
 * Sent after the password actually changes.
 *
 * This is the email that matters most and did not exist. A password reset that
 * a member did not initiate is the visible half of an account takeover, and
 * without this notice the first they learn of it is when they can no longer
 * sign in — so it is toned as a warning rather than a confirmation.
 */
export const passwordChanged = (
  ctx: EmailContext,
  data: { name: string; changedAt: Date }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Your password was changed — ${ctx.siteName}`,
    previewText: "Confirming a password change on your account. If this wasn't you, act now.",
    eyebrow: "Security notice",
    tone: "warning",
    title: "Your password was changed",
    lead: `${esc(data.name)}, the password on your account was changed and every signed-in device has been signed out.`,
    body: stack([
      dataCard(t, {
        title: "What happened",
        rows: [
          {
            label: "Changed",
            value: esc(
              new Date(data.changedAt).toLocaleString("en-GB", {
                dateStyle: "full",
                timeStyle: "short",
              })
            ),
          },
        ],
      }),
      notice(t, {
        title: "If this wasn't you",
        body: `Your account may be compromised. Reset your password immediately, then write to <a href="mailto:${esc(ctx.contactEmail)}" style="color:${t.primaryDeep};font-weight:700;">${esc(ctx.contactEmail)}</a>.`,
        tone: "danger",
      }),
    ]),
    action: button(t, "Reset my password", absoluteUrl("/forgot-password"), { variant: "secondary" }),
  };
};

/**
 * Sent to the old *and* the new address.
 *
 * Only mailing the new one would mean an attacker who changes the address
 * silently removes the owner's last channel of notice.
 */
export const emailChanged = (
  ctx: EmailContext,
  data: { name: string; oldEmail: string; newEmail: string; audience: "old" | "new" }
): TemplateOutput => {
  const t = themed(ctx);
  const toOld = data.audience === "old";
  return {
    subject: `The email address on your account was changed — ${ctx.siteName}`,
    previewText: toOld
      ? "Your account now uses a different email address. If this wasn't you, act now."
      : "This address is now the sign-in address for your account.",
    eyebrow: "Security notice",
    tone: toOld ? "warning" : "neutral",
    title: "Your sign-in address changed",
    lead: `${esc(data.name)}, the email address on your ${esc(ctx.siteName)} account was updated.`,
    body: stack([
      dataCard(t, {
        title: "The change",
        rows: [
          { label: "Previous", value: esc(data.oldEmail) },
          { label: "New", value: esc(data.newEmail), emphasis: true },
        ],
      }),
      toOld
        ? notice(t, {
            title: "If you did not make this change",
            body: `Contact us straight away at <a href="mailto:${esc(ctx.contactEmail)}" style="color:${t.primaryDeep};font-weight:700;">${esc(ctx.contactEmail)}</a>. This is the last message we can send to this address.`,
            tone: "danger",
          })
        : paragraph(t, "Sign in with this address from now on. Your password is unchanged."),
    ]),
  };
};
