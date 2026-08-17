/**
 * GDPR correspondence.
 *
 * The consent machinery already existed and sent nothing. Under Art. 12(3) a
 * controller must inform the data subject of the action taken on their
 * request, and under Art. 19 of the consequences of erasure; a page that
 * rendered the answer on screen and then forgot it is thin evidence that
 * either happened. These are also the association's own paper trail.
 */

import type { MessageContext } from "../shell";
import { themed } from "../shell";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import { bulletList, esc, facts, notice, paragraph, strong } from "../blocks";

const date = (d: Date) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** Art. 15 — a copy of the data we hold. */
export const dataExportReady = (
  ctx: MessageContext,
  data: { name: string; requestedAt: Date }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: "Your data export is ready",
    previewText: "A copy of everything we hold about you, ready to download.",
    eyebrow: "Data request",
    title: "Your data export is ready",
    accentWord: "ready",
    lead: `${esc(data.name)}, you asked for a copy of the personal data we hold about you under Article 15 GDPR. It is ready to download from your privacy settings.`,
    sections: [
      {
        label: "Your request",
        blocks: [
          facts(t, [
            { label: "Requested", value: esc(date(data.requestedAt)) },
            { label: "Format", value: "JSON" },
          ]),
          paragraph(
            t,
            "Your profile, memberships, event registrations, consent history and gallery contributions. It is available while you are signed in; we do not attach it to email, because email is not a safe place to put a complete copy of somebody's personal data.",
            { small: true, muted: true }
          ),
        ],
      },
    ],
    close: {
      button: { label: "Download my data", href: absoluteUrl("/profile/privacy") },
    },
  };
};

/** Art. 17 — acknowledgement, with the statutory deadline named. */
export const deletionRequested = (
  ctx: MessageContext,
  data: { name: string; requestedAt: Date; deadline: Date }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: "We have your deletion request",
    previewText: `We will complete it by ${date(data.deadline)}.`,
    eyebrow: "Erasure request",
    title: "Your deletion request is recorded",
    accentWord: "recorded",
    lead: `${esc(data.name)}, we have received your request to erase your personal data under Article 17 GDPR.`,
    sections: [
      {
        label: "Your request",
        blocks: [
          facts(t, [
            { label: "Requested", value: esc(date(data.requestedAt)) },
            { label: "Completed by", value: esc(date(data.deadline)), emphasis: true },
          ]),
          notice(t, {
            title: "Changed your mind?",
            body: "You can withdraw this request from your privacy settings at any point before it is carried out. Afterwards it cannot be undone.",
          }),
        ],
      },
      {
        label: "What will happen",
        blocks: [
          bulletList(t, [
            `${strong(t, "Your profile is anonymised")} — name, email, address, phone, photograph and biometric data are removed.`,
            `${strong(t, "Your consent records are kept")}, without identifying you, because they are the evidence that consent was lawfully obtained.`,
            `${strong(t, "Payment and invoice records are kept for ten years.")} German tax and commercial law (§ 147 AO, § 257 HGB) requires it, and Art. 17(3)(b) GDPR permits it — so those rows survive, stripped of everything that points to you.`,
          ]),
        ],
      },
    ],
    close: {
      button: { label: "Manage my request", href: absoluteUrl("/profile/privacy") },
    },
  };
};

export const deletionAdminNotice = (
  ctx: MessageContext,
  data: {
    memberName: string;
    memberEmail: string;
    requestedAt: Date;
    deadline: Date;
    hasActiveMembership: boolean;
  }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Erasure request: ${data.memberName}`,
    previewText: `Statutory deadline ${date(data.deadline)}.`,
    eyebrow: "Committee · GDPR",
    title: "An erasure request needs action",
    accentWord: "action",
    lead: `${strong(t, esc(data.memberName))} has asked for erasure. Art. 12(3) GDPR gives the association one month.`,
    sections: [
      {
        label: "Request",
        blocks: [
          facts(t, [
            { label: "Member", value: esc(data.memberName), emphasis: true },
            { label: "Email", value: esc(data.memberEmail) },
            { label: "Requested", value: esc(date(data.requestedAt)) },
            { label: "Deadline", value: esc(date(data.deadline)) },
          ]),
          notice(t, {
            title: "One month",
            body: "Art. 12(3) GDPR gives the association a month to act. Missing it is a supervisory-authority matter, not an internal one.",
          }),
          data.hasActiveMembership
            ? notice(t, {
                title: "This member has an active membership",
                body: "Confirm they understand it ends with the erasure, and keep the financial records — those are retained under § 147 AO regardless.",
              })
            : null,
        ],
      },
    ],
    close: {
      button: { label: "Open member record", href: absoluteUrl("/admin/members") },
    },
  };
};

export const deletionCancelled = (ctx: MessageContext, data: { name: string }): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: "Your deletion request was withdrawn",
    previewText: "Your account stays as it is. Nothing was removed.",
    eyebrow: "Erasure withdrawn",
    title: "Your request is withdrawn",
    accentWord: "withdrawn",
    lead: `${esc(data.name)}, you have withdrawn your erasure request. Nothing was deleted and your account continues exactly as before.`,
    sections: [
      {
        blocks: [
          paragraph(t, "You can make the request again at any time — the right does not expire."),
        ],
      },
    ],
    close: {
      button: { label: "Privacy settings", href: absoluteUrl("/profile/privacy") },
    },
  };
};

/**
 * The last email this person will ever receive from us.
 *
 * Sent before the address is cleared, because after anonymisation there is
 * nowhere to send it — and a member is entitled to be told that the thing they
 * asked for was actually done.
 */
export const deletionCompleted = (
  ctx: MessageContext,
  data: { name: string; completedAt: Date }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: "Your data has been erased",
    previewText: "Done. This is the last email you will receive from us.",
    eyebrow: "Erasure complete",
    title: "Your data has been erased",
    accentWord: "erased",
    lead: `${esc(data.name)}, your erasure request has been carried out in full on ${strong(t, esc(date(data.completedAt)))}.`,
    sections: [
      {
        label: "What was done",
        blocks: [
          bulletList(t, [
            "Your name, email address, postal address, phone number, photograph and any biometric data have been removed from our systems.",
            "Your account can no longer be signed in to.",
            "Anonymised financial records remain for ten years under § 147 AO and § 257 HGB. They no longer identify you.",
          ]),
          notice(t, {
            body: `${strong(t, "This is the last message we will send to this address.")} If you would like to be part of the association again in future you are very welcome — you would simply start with a new account.`,
          }),
        ],
      },
    ],
    close: {
      note: "Thank you for the time you spent with us.",
    },
  };
};

/** A legal document changed in a way that needs fresh agreement. */
export const legalUpdate = (
  ctx: MessageContext,
  data: {
    name: string;
    documentTitle: string;
    changeNote?: string;
    requiresConsent: boolean;
    effectiveFrom: Date;
  }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: data.requiresConsent
      ? `Please review our updated ${data.documentTitle}`
      : `We have updated our ${data.documentTitle}`,
    previewText: data.changeNote || `It changes on ${date(data.effectiveFrom)}.`,
    eyebrow: "Policy update",
    title: `Our ${data.documentTitle} has changed`,
    accentWord: "changed",
    lead: `${esc(data.name)}, we have published a new version of our ${strong(t, esc(data.documentTitle))}, effective ${strong(t, esc(date(data.effectiveFrom)))}.`,
    sections: [
      {
        blocks: [
          data.changeNote
            ? notice(t, { title: "What changed", body: esc(data.changeNote) })
            : null,
          paragraph(
            t,
            data.requiresConsent
              ? "Because this change affects how we handle your personal data, we need your agreement to the new version. You will be asked the next time you sign in, and it takes a moment."
              : "No action is needed — we are telling you because you have a right to know when these terms change."
          ),
        ],
      },
    ],
    close: {
      button: data.requiresConsent
        ? { label: "Review and agree", href: absoluteUrl("/profile/privacy") }
        : { label: "Read the new version", href: absoluteUrl("/legal/privacy") },
    },
  };
};
