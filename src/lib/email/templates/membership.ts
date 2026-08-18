/** Membership lifecycle: application, verification, activation, renewal. */

import type { MessageContext } from "../shell";
import { themed } from "../shell";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import { bulletList, esc, facts, notice, paragraph, quote, steps, strong } from "../blocks";

const date = (d?: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

/**
 * Acknowledges a student application, which cannot be paid for until the ID is
 * verified — so it deliberately says nothing about money.
 */
export const studentApplicationReceived = (
  ctx: MessageContext,
  data: { name: string; planName: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `We have your ${data.planName} application`,
    previewText: "We are checking your student ID and will be in touch.",
    eyebrow: "Application received",
    title: "Application received",
    accentWord: "received",
    lead: `Thank you, ${esc(data.name)}. Your application for the ${strong(t, esc(data.planName))} membership is with us and is pending verification.`,
    sections: [
      {
        label: "What happens next",
        blocks: [
          steps(t, [
            "A committee member checks your student ID — usually within a few days.",
            "Once confirmed, we send you the bank details and your payment reference.",
            `${strong(t, "Your term starts on the day we record your payment")}, not today.`,
          ]),
          notice(t, {
            body: "We have not asked you for any money yet, and will not until your status is confirmed.",
          }),
        ],
      },
    ],
    close: {
      button: { label: "View my application", href: absoluteUrl("/profile") },
    },
  };
};

/**
 * Acknowledges a standard application.
 *
 * A standard applicant previously went straight from the form to a payment
 * demand with nothing in between, so the first email they ever received from
 * the association was a bill.
 */
export const applicationReceived = (
  ctx: MessageContext,
  data: { name: string; planName: string; amount: number }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `We have your ${data.planName} application`,
    previewText: "Payment details are on their way in a separate email.",
    eyebrow: "Application received",
    title: "Application received",
    accentWord: "received",
    lead: `Thank you, ${esc(data.name)}. Your application for the ${strong(t, esc(data.planName))} membership has been recorded.`,
    sections: [
      {
        label: "Your application",
        blocks: [
          facts(t, [
            { label: "Plan", value: esc(data.planName) },
            { label: "Contribution", value: `€${data.amount.toFixed(2)}`, emphasis: true },
          ]),
        ],
      },
      {
        label: "What happens next",
        blocks: [
          steps(t, [
            "A separate email follows straight after this one with the bank details, your payment reference and your invoice as a PDF.",
            "You transfer the amount, quoting the reference exactly.",
            `${strong(t, "Your membership begins the day we record your payment")} and runs a full term from that date.`,
          ]),
        ],
      },
    ],
    close: {
      note: "Nothing to do right now — watch for the payment email.",
    },
  };
};

/** Committee notice that a student ID is waiting to be checked. */
export const applicationAdminNotice = (
  ctx: MessageContext,
  data: { memberName: string; memberEmail: string; planName: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Student verification needed: ${data.memberName}`,
    previewText: `${data.memberName} applied for ${data.planName}.`,
    eyebrow: "Committee",
    title: "A student application needs review",
    accentWord: "review",
    lead: `${strong(t, esc(data.memberName))} has applied for the ${esc(data.planName)} membership and their ID needs checking.`,
    sections: [
      {
        label: "Applicant",
        blocks: [
          facts(t, [
            { label: "Name", value: esc(data.memberName), emphasis: true },
            { label: "Email", value: esc(data.memberEmail) },
            { label: "Plan", value: esc(data.planName) },
          ]),
        ],
      },
    ],
    close: {
      button: {
        label: "Review the application",
        href: absoluteUrl("/admin/membership/applications"),
      },
      note: "Nobody has been asked to pay yet — the payment request goes out automatically once you approve.",
    },
  };
};

export const studentVerified = (
  ctx: MessageContext,
  data: { name: string; planName: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: "Your student status is verified",
    previewText: "Payment details follow in the next email.",
    eyebrow: "Verified",
    title: "Student status verified",
    accentWord: "verified",
    lead: `Good news, ${esc(data.name)} — we have confirmed your student status for the ${strong(t, esc(data.planName))} membership.`,
    sections: [
      {
        blocks: [
          paragraph(
            t,
            "The payment details and your invoice follow in a separate email. Your membership starts on the day we record the payment, and we will confirm the exact dates then."
          ),
        ],
      },
    ],
    close: {
      button: { label: "Go to my profile", href: absoluteUrl("/profile") },
    },
  };
};

export const applicationRejected = (
  ctx: MessageContext,
  data: { name: string; planName: string; reason?: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `About your ${data.planName} application`,
    previewText: "We could not verify your student status this time.",
    eyebrow: "Application update",
    title: "We could not verify your application",
    accentWord: "verify",
    lead: `${esc(data.name)}, we have reviewed your application for the ${strong(t, esc(data.planName))} membership and were not able to confirm your student status.`,
    sections: [
      {
        blocks: [
          data.reason ? quote(t, data.reason) : null,
          paragraph(
            t,
            "This is usually something small — a photograph that is hard to read, or an enrolment date that has passed. You are very welcome to apply again with a clearer image."
          ),
        ],
      },
    ],
    close: {
      button: { label: "Apply again", href: absoluteUrl("/membership") },
      note: "If you think we have this wrong, reply to this email and a person will look at it again.",
    },
  };
};

/**
 * The membership is live. Distinct from the payment receipt, which is a
 * financial record — this one is the welcome.
 */
export const membershipActive = (
  ctx: MessageContext,
  data: {
    name: string;
    planName: string;
    startDate?: Date | null;
    endDate?: Date | null;
    features: string[];
  }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `You're a member of ${ctx.siteName}`,
    previewText: "Your membership is active. Here is what comes with it.",
    eyebrow: "Membership active",
    title: `Welcome, ${data.name}`,
    accentWord: data.name,
    lead: `Your ${strong(t, esc(data.planName))} membership is active. Thank you for supporting the association — subscriptions are what pay for the hall, the sound system and the sadya.`,
    sections: [
      {
        label: "Your membership",
        blocks: [
          facts(t, [
            { label: "Plan", value: esc(data.planName) },
            { label: "Member since", value: esc(date(data.startDate)) },
            { label: "Valid until", value: esc(date(data.endDate)), emphasis: true },
          ]),
        ],
      },
      {
        label: "What comes with it",
        blocks: [
          bulletList(
            t,
            data.features.length
              ? data.features.slice(0, 6).map((f) => esc(f))
              : [
                  `${strong(t, "Member pricing")} at every event we run.`,
                  `${strong(t, "A vote")} at the general meeting.`,
                  `${strong(t, "Early notice")} of events that fill up.`,
                ]
          ),
        ],
      },
    ],
    close: {
      eyebrow: "Your account",
      button: { label: "Go to my profile", href: absoluteUrl("/profile") },
      note: "We will remind you well before your membership is due for renewal.",
    },
  };
};

/** T-30 and T-7. Transactional: it concerns money and a lapsing entitlement. */
export const membershipExpiring = (
  ctx: MessageContext,
  data: { name: string; planName: string; endDate: Date; daysLeft: number; amount: number }
): TemplateOutput => {
  const t = themed(ctx);
  const urgent = data.daysLeft <= 7;

  return {
    subject: urgent
      ? `Your membership ends in ${data.daysLeft} days`
      : "Your membership renews next month",
    previewText: `The ${data.planName} term expires on ${date(data.endDate)}.`,
    eyebrow: urgent ? `${data.daysLeft} days left` : "Renewal due",
    title: urgent ? "Your membership is about to end" : "Time to renew",
    accentWord: urgent ? "end" : "renew",
    lead: `${esc(data.name)}, your ${strong(t, esc(data.planName))} membership runs out in ${strong(t, `${data.daysLeft} days`)}. Renewing keeps your member pricing and your vote without a gap.`,
    sections: [
      {
        label: "Renewal",
        blocks: [
          facts(t, [
            { label: "Expires", value: esc(date(data.endDate)), emphasis: true },
            { label: "Amount", value: `€${data.amount.toFixed(2)}` },
          ]),
          paragraph(
            t,
            "Renew before the expiry date and your new term picks up where this one ends — no lost days.",
            { small: true, muted: true }
          ),
        ],
      },
    ],
    close: {
      button: { label: "Renew my membership", href: absoluteUrl("/membership") },
    },
  };
};

export const membershipExpired = (
  ctx: MessageContext,
  data: { name: string; planName: string; endDate: Date }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: "Your membership has expired",
    previewText: `The ${data.planName} term ended on ${date(data.endDate)}. You can rejoin any time.`,
    eyebrow: "Membership expired",
    title: "Your membership has ended",
    accentWord: "ended",
    lead: `${esc(data.name)}, your ${strong(t, esc(data.planName))} membership expired on ${strong(t, esc(date(data.endDate)))}.`,
    sections: [
      {
        blocks: [
          paragraph(
            t,
            "You are still very much part of the community — you will simply pay the non-member price at events, and you cannot vote at the general meeting until you rejoin."
          ),
          paragraph(
            t,
            "Rejoining takes a minute and starts a fresh term from the day your payment is recorded."
          ),
        ],
      },
    ],
    close: {
      button: { label: "Rejoin", href: absoluteUrl("/membership") },
      note: "If you have decided not to continue, thank you for the time you gave us. You are welcome back whenever.",
    },
  };
};

export const membershipRenewed = (
  ctx: MessageContext,
  data: { name: string; planName: string; startDate?: Date | null; endDate?: Date | null }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: "Your membership is renewed",
    previewText: `Renewed through ${date(data.endDate)}. Thank you.`,
    eyebrow: "Renewed",
    title: "Renewed — thank you",
    accentWord: "Renewed",
    lead: `${esc(data.name)}, your ${strong(t, esc(data.planName))} membership has been renewed for another term.`,
    sections: [
      {
        label: "New term",
        blocks: [
          facts(t, [
            { label: "Begins", value: esc(date(data.startDate)) },
            { label: "Valid until", value: esc(date(data.endDate)), emphasis: true },
          ]),
          paragraph(t, "Nothing else changes — same member pricing, same access, no gap.", {
            small: true,
            muted: true,
          }),
        ],
      },
    ],
    close: {
      button: { label: "Go to my profile", href: absoluteUrl("/profile") },
    },
  };
};
