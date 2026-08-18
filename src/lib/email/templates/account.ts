/** Account and security email. */

import type { MessageContext } from "../shell";
import { themed } from "../shell";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import { bulletList, code, esc, facts, notice, paragraph, strong } from "../blocks";

export const verifyEmail = (ctx: MessageContext, data: { verifyLink: string }): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: "Confirm your email address",
    previewText: "One click and your account is ready. The link is good for 24 hours.",
    eyebrow: "Confirm your account",
    title: "Confirm your email address",
    accentWord: "Confirm",
    lead: `Welcome to ${esc(ctx.siteName)}. Confirm this address and your member portal is ready to use.`,
    sections: [],
    close: {
      button: { label: "Verify my email", href: data.verifyLink },
      note: "This link expires in 24 hours. If you did not create an account you can ignore this message — nothing happens without the confirmation.",
    },
  };
};

export const welcome = (ctx: MessageContext, data: { name: string }): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Welcome to ${ctx.siteName}`,
    previewText: "Your account is active. Here is what you can do with it.",
    eyebrow: "Welcome",
    title: `Namaskaram, ${data.name}`,
    accentWord: data.name,
    lead: "Your email is confirmed and your account is active. You are now part of the community.",
    sections: [
      {
        label: "What you can do",
        blocks: [
          bulletList(t, [
            `${strong(t, "Book events")} — register for gatherings, festivals and socials.`,
            `${strong(t, "Become a member")} — members pay less at events and can vote at the general meeting.`,
            `${strong(t, "Share photographs")} — contribute your pictures to the community albums.`,
          ]),
        ],
      },
    ],
    close: {
      eyebrow: "Get started",
      button: { label: "Explore upcoming events", href: absoluteUrl("/events") },
      note: "Questions at any point? Reply to this email and a person will read it.",
    },
  };
};

export const otpCode = (ctx: MessageContext, data: { code: string }): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `${data.code} is your verification code`,
    previewText: "Enter it within 10 minutes to continue.",
    eyebrow: "Verification code",
    title: "Your code is below",
    accentWord: "code",
    lead: "Enter this to continue with your membership application. It is valid for 10 minutes.",
    sections: [{ blocks: [code(t, data.code)] }],
    close: {
      note: "If you did not ask for this code, someone may have typed your address by mistake. You can ignore this message.",
    },
  };
};

export const passwordReset = (ctx: MessageContext, data: { resetLink: string }): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: "Set a new password",
    previewText: "A link to choose a new password. It expires in one hour.",
    eyebrow: "Security",
    title: "Set a new password",
    accentWord: "new",
    lead: "We received a request to reset the password for your account. Use the button below to choose a new one.",
    sections: [
      {
        blocks: [
          notice(t, {
            title: "Didn't request this?",
            body: "Then no action is needed — your password has not changed. If you keep receiving these, reply and tell us.",
          }),
        ],
      },
    ],
    close: {
      button: { label: "Choose a new password", href: data.resetLink },
      note: "The link expires in one hour and can be used once.",
    },
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
  ctx: MessageContext,
  data: { name: string; changedAt: Date }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: "Your password was changed",
    previewText: "Confirming a change on your account. If this wasn't you, act now.",
    eyebrow: "Security notice",
    title: "Your password was changed",
    accentWord: "changed",
    lead: `${esc(data.name)}, the password on your account was changed and every signed-in device has been signed out.`,
    sections: [
      {
        label: "What happened",
        blocks: [
          facts(t, [
            {
              label: "Changed",
              value: esc(
                new Date(data.changedAt).toLocaleString("en-GB", {
                  dateStyle: "full",
                  timeStyle: "short",
                })
              ),
            },
          ]),
          notice(t, {
            title: "If this wasn't you",
            body: `Your account may be compromised. Reset your password immediately, then write to <a href="mailto:${esc(ctx.contactEmail)}" style="color:${t.primaryDeep};font-weight:700;">${esc(ctx.contactEmail)}</a>.`,
          }),
        ],
      },
    ],
    close: {
      // Not `/reset-password` — that route needs a token this email never had.
      // Not `/admin/login` either — this is sent to both portals' owners
      // (`resetPassword` is audience-agnostic; `acceptInvite` is admin-only,
      // but the two share this template). The home page's header exposes
      // sign-in with its own "Forgot password?" option for either audience,
      // and is guaranteed to resolve, unlike the old `/forgot-password`.
      button: { label: "Reset my password", href: absoluteUrl("/") },
      note: "You are receiving this because it affects your account's security.",
    },
  };
};

/**
 * Sent to the old *and* the new address.
 *
 * Only mailing the new one would mean an attacker who changes the address
 * silently removes the owner's last channel of notice.
 */
export const emailChanged = (
  ctx: MessageContext,
  data: { name: string; oldEmail: string; newEmail: string; audience: "old" | "new" }
): TemplateOutput => {
  const t = themed(ctx);
  const toOld = data.audience === "old";
  return {
    subject: "Your sign-in address was changed",
    previewText: toOld
      ? "Your account now uses a different email address. If this wasn't you, act now."
      : "This address is now the sign-in address for your account.",
    eyebrow: "Security notice",
    title: "Your sign-in address changed",
    accentWord: "changed",
    lead: `${esc(data.name)}, the email address on your ${esc(ctx.siteName)} account was updated.`,
    sections: [
      {
        label: "The change",
        blocks: [
          facts(t, [
            { label: "Previous", value: esc(data.oldEmail) },
            { label: "New", value: esc(data.newEmail), emphasis: true },
          ]),
          toOld
            ? notice(t, {
                title: "If you did not make this change",
                body: `Contact us straight away at <a href="mailto:${esc(ctx.contactEmail)}" style="color:${t.primaryDeep};font-weight:700;">${esc(ctx.contactEmail)}</a>. This is the last message we can send to this address.`,
              })
            : paragraph(t, "Sign in with this address from now on. Your password is unchanged."),
        ],
      },
    ],
    close: {
      note: "You are receiving this because it affects how you sign in.",
    },
  };
};
