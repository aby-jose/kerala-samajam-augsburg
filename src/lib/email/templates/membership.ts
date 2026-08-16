/** Membership lifecycle: application, verification, activation, renewal. */

import type { EmailContext } from "../layout";
import { themed } from "../layout";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import {
  bulletList,
  button,
  dataCard,
  esc,
  note,
  notice,
  paragraph,
  quote,
  stack,
  steps,
  strong,
} from "../components";

const date = (d?: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

/**
 * Acknowledges a student application, which cannot be paid for until the ID is
 * verified — so it deliberately says nothing about money.
 */
export const studentApplicationReceived = (
  ctx: EmailContext,
  data: { name: string; planName: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `We have your application — ${data.planName}`,
    previewText: "Received. We are checking your student ID and will be in touch.",
    eyebrow: "Application received",
    tone: "warning",
    title: "Application received",
    lead: `Thank you, ${esc(data.name)}. Your application for the ${strong(t, esc(data.planName))} membership is with us and is pending verification.`,
    body: stack([
      steps(t, [
        "A committee member checks your student ID — usually within a few days.",
        "Once confirmed, we send you the bank details and your payment reference.",
        `${strong(t, "Your term starts on the day we record your payment")}, not today.`,
      ]),
      notice(t, {
        body: "We have not asked you for any money yet, and will not until your status is confirmed.",
        tone: "neutral",
      }),
    ]),
    action: button(t, "View my application", absoluteUrl("/profile"), { variant: "secondary" }),
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
  ctx: EmailContext,
  data: { name: string; planName: string; amount: number }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `We have your application — ${data.planName}`,
    previewText: "Received. Payment details are on their way in a separate email.",
    eyebrow: "Application received",
    title: "Welcome — application received",
    lead: `Thank you, ${esc(data.name)}. Your application for the ${strong(t, esc(data.planName))} membership has been recorded.`,
    body: stack([
      dataCard(t, {
        title: "Your application",
        rows: [
          { label: "Plan", value: esc(data.planName) },
          { label: "Contribution", value: `€${data.amount.toFixed(2)}`, emphasis: true },
        ],
      }),
      steps(t, [
        "A separate email follows straight after this one with the bank details, your payment reference and your invoice as a PDF.",
        "You transfer the amount, quoting the reference exactly.",
        `${strong(t, "Your membership begins the day we record your payment")} and runs a full term from that date.`,
      ]),
    ]),
  };
};

/** Committee notice that a student ID is waiting to be checked. */
export const applicationAdminNotice = (
  ctx: EmailContext,
  data: { memberName: string; memberEmail: string; planName: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Student verification needed: ${data.memberName}`,
    previewText: `${data.memberName} applied for ${data.planName} and needs their ID checked.`,
    eyebrow: "Committee",
    tone: "warning",
    title: "A student application needs review",
    body: dataCard(t, {
      title: "Applicant",
      rows: [
        { label: "Name", value: esc(data.memberName), emphasis: true },
        { label: "Email", value: esc(data.memberEmail) },
        { label: "Plan", value: esc(data.planName) },
      ],
      footnote:
        "Nobody has been asked to pay yet — the payment request goes out automatically once you approve.",
    }),
    action: button(t, "Review the application", absoluteUrl("/admin/membership/applications")),
  };
};

export const studentVerified = (
  ctx: EmailContext,
  data: { name: string; planName: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Your student status is verified — ${ctx.siteName}`,
    previewText: "Verified. Payment details follow in the next email.",
    eyebrow: "Verified",
    tone: "success",
    title: "Student status verified",
    lead: `Good news, ${esc(data.name)} — we have confirmed your student status for the ${strong(t, esc(data.planName))} membership.`,
    body: paragraph(
      t,
      "The payment details and your invoice follow in a separate email. Your membership starts on the day we record the payment, and we will confirm the exact dates then."
    ),
    action: button(t, "Go to my profile", absoluteUrl("/profile")),
  };
};

export const applicationRejected = (
  ctx: EmailContext,
  data: { name: string; planName: string; reason?: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `About your ${data.planName} application`,
    previewText: "We could not verify your student status this time.",
    eyebrow: "Application update",
    tone: "neutral",
    title: "We could not verify your application",
    lead: `${esc(data.name)}, we have reviewed your application for the ${strong(t, esc(data.planName))} membership and were not able to confirm your student status.`,
    body: stack([
      data.reason ? quote(t, data.reason) : null,
      paragraph(
        t,
        "This is usually something small — a photograph that is hard to read, or an enrolment date that has passed. You are very welcome to apply again with a clearer image."
      ),
    ]),
    action: button(t, "Apply again", absoluteUrl("/membership")),
    note: note(
      t,
      "If you think we have this wrong, reply to this email and a person will look at it again."
    ),
  };
};

/**
 * The membership is live. Distinct from the payment receipt, which is a
 * financial record — this one is the welcome.
 */
export const membershipActive = (
  ctx: EmailContext,
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
    tone: "success",
    title: `Welcome, ${data.name}`,
    lead: `Your ${strong(t, esc(data.planName))} membership is active. Thank you for supporting the association — subscriptions are what pay for the hall, the sound system and the sadya.`,
    body: stack([
      dataCard(t, {
        title: "Your membership",
        tone: "success",
        rows: [
          { label: "Plan", value: esc(data.planName) },
          { label: "Member since", value: esc(date(data.startDate)) },
          { label: "Valid until", value: esc(date(data.endDate)), emphasis: true },
        ],
      }),
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
    ]),
    action: button(t, "Go to my profile", absoluteUrl("/profile")),
    note: note(t, "We will remind you well before your membership is due for renewal."),
  };
};

/** T-30 and T-7. Transactional: it concerns money and a lapsing entitlement. */
export const membershipExpiring = (
  ctx: EmailContext,
  data: { name: string; planName: string; endDate: Date; daysLeft: number; amount: number }
): TemplateOutput => {
  const t = themed(ctx);
  const urgent = data.daysLeft <= 7;

  return {
    subject: urgent
      ? `Your membership ends in ${data.daysLeft} days`
      : `Your membership renews next month`,
    previewText: `Your ${data.planName} membership expires on ${date(data.endDate)}.`,
    eyebrow: urgent ? `${data.daysLeft} days left` : "Renewal due",
    tone: urgent ? "warning" : "brand",
    title: urgent ? "Your membership is about to end" : "Time to renew",
    lead: `${esc(data.name)}, your ${strong(t, esc(data.planName))} membership runs out in ${strong(t, `${data.daysLeft} days`)}. Renewing keeps your member pricing and your vote without a gap.`,
    body: dataCard(t, {
      title: "Renewal",
      tone: urgent ? "warning" : "brand",
      rows: [
        { label: "Expires", value: esc(date(data.endDate)), emphasis: true },
        { label: "Amount", value: `€${data.amount.toFixed(2)}` },
      ],
      footnote:
        "Renew before the expiry date and your new term picks up where this one ends — no lost days.",
    }),
    action: button(t, "Renew my membership", absoluteUrl("/membership")),
  };
};

export const membershipExpired = (
  ctx: EmailContext,
  data: { name: string; planName: string; endDate: Date }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Your membership has expired`,
    previewText: `Your ${data.planName} membership ended on ${date(data.endDate)}. You can rejoin any time.`,
    eyebrow: "Membership expired",
    tone: "neutral",
    title: "Your membership has ended",
    lead: `${esc(data.name)}, your ${strong(t, esc(data.planName))} membership expired on ${strong(t, esc(date(data.endDate)))}.`,
    body: stack([
      paragraph(
        t,
        "You are still very much part of the community — you will simply pay the non-member price at events, and you cannot vote at the general meeting until you rejoin."
      ),
      paragraph(
        t,
        "Rejoining takes a minute and starts a fresh term from the day your payment is recorded."
      ),
    ]),
    action: button(t, "Rejoin", absoluteUrl("/membership")),
    note: note(
      t,
      "If you have decided not to continue, thank you for the time you gave us. You are welcome back whenever."
    ),
  };
};

export const membershipRenewed = (
  ctx: EmailContext,
  data: { name: string; planName: string; startDate?: Date | null; endDate?: Date | null }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Your membership is renewed`,
    previewText: `Renewed through ${date(data.endDate)}. Thank you.`,
    eyebrow: "Renewed",
    tone: "success",
    title: "Renewed — thank you",
    lead: `${esc(data.name)}, your ${strong(t, esc(data.planName))} membership has been renewed for another term.`,
    body: dataCard(t, {
      title: "New term",
      tone: "success",
      rows: [
        { label: "Begins", value: esc(date(data.startDate)) },
        { label: "Valid until", value: esc(date(data.endDate)), emphasis: true },
      ],
      footnote: "Nothing else changes — same member pricing, same access, no gap.",
    }),
    action: button(t, "Go to my profile", absoluteUrl("/profile")),
  };
};
