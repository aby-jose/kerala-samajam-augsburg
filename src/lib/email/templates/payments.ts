/**
 * Money.
 *
 * There is no payment gateway: everything here describes a transfer a member
 * makes themselves, or an administrator's statement that one arrived. That
 * asymmetry is why "here is what you owe" and "we have your money" are two
 * separate templates rather than one message that assumes the payment already
 * happened.
 */

import type { MessageContext } from "../shell";
import { themed } from "../shell";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import { amount, esc, facts, notice, paragraph, strong } from "../blocks";

const date = (d?: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

export interface BankDetails {
  accountHolder?: string;
  bankName?: string;
  iban?: string;
  bic?: string;
}

/** How to pay a membership subscription, with the invoice attached. */
export const membershipPaymentRequest = (
  ctx: MessageContext,
  data: {
    name: string;
    planName: string;
    amount: number;
    reference: string;
    dueDate: Date;
    bank: BankDetails;
    method: string;
  }
): TemplateOutput => {
  const t = themed(ctx);
  const byCash = data.method === "CASH";

  return {
    subject: `How to pay for your ${data.planName} membership`,
    previewText: `€${data.amount.toFixed(2)} by ${date(data.dueDate)}, quoting ${data.reference}.`,
    eyebrow: "Payment due",
    title: "How to pay",
    accentWord: "pay",
    lead: `${esc(data.name)}, thank you for joining. To activate your ${strong(t, esc(data.planName))} membership, please send the amount below by ${strong(t, esc(date(data.dueDate)))}.`,
    sections: [
      {
        blocks: [
          amount(t, {
            caption: "Amount due",
            amount: data.amount,
            sub: `by ${esc(date(data.dueDate))}`,
          }),
          byCash
            ? notice(t, {
                title: "You chose to pay in cash",
                body: "Bring the amount to the next committee meeting or event and we will record it on the spot. If you would rather transfer it after all, the details are below.",
              })
            : null,
        ],
      },
      {
        label: "Bank transfer",
        blocks: [
          facts(t, [
            { label: "Account holder", value: esc(data.bank.accountHolder || "") },
            { label: "Bank", value: esc(data.bank.bankName || "") },
            { label: "IBAN", value: esc(data.bank.iban || ""), mono: true },
            { label: "BIC", value: esc(data.bank.bic || ""), mono: true },
            { label: "Reference", value: esc(data.reference), mono: true, emphasis: true },
          ]),
          notice(t, {
            title: "Quote the reference exactly",
            body: "It is the only thing that tells us which transfer belongs to which member. Without it your payment sits unmatched and your membership stays inactive.",
          }),
        ],
      },
    ],
    close: {
      eyebrow: "Your membership",
      button: { label: "View my membership", href: absoluteUrl("/profile") },
      note: "Your membership starts on the day we record your payment, and runs a full term from that date. Your invoice is attached to this email.",
    },
  };
};

/** Confirmation that a membership payment arrived, with the receipt attached. */
export const membershipPaymentReceived = (
  ctx: MessageContext,
  data: {
    name: string;
    planName: string;
    amount: number;
    startDate?: Date | null;
    endDate?: Date | null;
    term: string;
    reference?: string | null;
  }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: "Payment received — your membership is active",
    previewText: `We have your €${data.amount.toFixed(2)}. Your receipt is attached.`,
    eyebrow: "Receipt",
    title: "Payment received",
    accentWord: "received",
    lead: `${esc(data.name)}, we have recorded your payment for the ${strong(t, esc(data.planName))} membership. It is active from today.`,
    sections: [
      {
        blocks: [
          amount(t, {
            caption: "Paid in full",
            amount: data.amount,
            sub: "Your receipt is attached as a PDF — keep it for your records.",
          }),
        ],
      },
      {
        label: "Your membership term",
        blocks: [
          facts(t, [
            { label: "Plan", value: esc(data.planName) },
            { label: "Member since", value: esc(date(data.startDate)) },
            { label: "Valid until", value: esc(date(data.endDate)), emphasis: true },
            { label: "Term", value: esc(data.term) },
            data.reference ? { label: "Reference", value: esc(data.reference), mono: true } : null,
          ]),
        ],
      },
    ],
    close: {
      eyebrow: "Your account",
      button: { label: "Go to my profile", href: absoluteUrl("/profile") },
      note: "We will remind you before the term is up.",
    },
  };
};

/**
 * An event fee was collected and recorded.
 *
 * This did not exist. An administrator would mark a bank transfer as received
 * and the member was never told: they went on holding a ticket that still said
 * "amount due at the door", with no receipt and no way to know the association
 * had matched their transfer.
 */
export const eventPaymentRecorded = (
  ctx: MessageContext,
  data: {
    name: string;
    eventTitle: string;
    eventSlug: string;
    ticketId: string;
    amount: number;
    method: string;
    paidAt: Date;
    reference?: string | null;
  }
): TemplateOutput => {
  const t = themed(ctx);
  const methodLabel = data.method === "CASH" ? "Cash" : "Bank transfer";

  return {
    subject: `Payment received for ${data.eventTitle}`,
    previewText: `€${data.amount.toFixed(2)} received. Nothing further to pay at the door.`,
    eyebrow: "Receipt",
    title: "Payment received",
    accentWord: "received",
    lead: `${esc(data.name)}, we have recorded your payment for ${strong(t, esc(data.eventTitle))}. There is nothing left to settle — just bring your ticket.`,
    sections: [
      { blocks: [amount(t, { caption: "Paid in full", amount: data.amount })] },
      {
        label: "Receipt",
        blocks: [
          facts(t, [
            { label: "Event", value: esc(data.eventTitle) },
            { label: "Method", value: esc(methodLabel) },
            { label: "Received", value: esc(date(data.paidAt)) },
            { label: "Ticket", value: esc(data.ticketId), mono: true, emphasis: true },
            data.reference ? { label: "Reference", value: esc(data.reference), mono: true } : null,
          ]),
        ],
      },
    ],
    close: {
      eyebrow: "The event",
      button: {
        label: "View event details",
        href: absoluteUrl(`/events/${data.eventSlug}`),
      },
      note: "Treat this email as your receipt. Your original ticket PDF is still the one to bring — it is valid whether or not it was paid when it was issued.",
    },
  };
};

/** An administrator undid a recorded payment. Rare, and worth explaining. */
export const eventPaymentReverted = (
  ctx: MessageContext,
  data: { name: string; eventTitle: string; eventSlug: string; ticketId: string; amount: number }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Correction: payment for ${data.eventTitle}`,
    previewText: "We have reversed a payment record on your registration.",
    eyebrow: "Correction",
    title: "We corrected our records",
    accentWord: "corrected",
    lead: `${esc(data.name)}, we had recorded a payment of ${strong(t, `€${data.amount.toFixed(2)}`)} against your registration for ${strong(t, esc(data.eventTitle))}, and that entry has been reversed.`,
    sections: [
      {
        blocks: [
          paragraph(
            t,
            "This almost always means a bookkeeping mix-up on our side rather than anything to do with you — for example, a transfer matched to the wrong registration."
          ),
        ],
      },
      {
        label: "Your registration",
        blocks: [
          facts(t, [
            { label: "Event", value: esc(data.eventTitle) },
            { label: "Ticket", value: esc(data.ticketId), mono: true, emphasis: true },
            { label: "Balance", value: `€${data.amount.toFixed(2)} outstanding` },
          ]),
          notice(t, {
            title: "Already paid?",
            body: "Reply to this email with the date and reference and we will fix it straight away. Otherwise the desk will ask for it at the door.",
          }),
        ],
      },
    ],
    close: {
      button: {
        label: "View event details",
        href: absoluteUrl(`/events/${data.eventSlug}`),
      },
    },
  };
};

/** The due date has passed. Firm about the facts, easy about the tone. */
export const paymentOverdue = (
  ctx: MessageContext,
  data: {
    name: string;
    planName: string;
    amount: number;
    reference: string;
    dueDate: Date;
    daysOverdue: number;
    bank: BankDetails;
    finalNotice: boolean;
  }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: data.finalNotice
      ? `Second reminder — your ${data.planName} payment`
      : `Reminder — your ${data.planName} payment`,
    previewText: `€${data.amount.toFixed(2)} was due on ${date(data.dueDate)}, quoting ${data.reference}.`,
    eyebrow: data.finalNotice ? "Second reminder" : "Payment reminder",
    title: data.finalNotice ? "A second reminder" : "A gentle reminder",
    accentWord: data.finalNotice ? "second" : "gentle",
    lead: `${esc(data.name)}, we have not yet been able to match a payment for your ${strong(t, esc(data.planName))} membership, which was due ${strong(t, `${data.daysOverdue} days ago`)}. Your membership will not start until it arrives.`,
    sections: [
      {
        blocks: [
          amount(t, {
            caption: "Still outstanding",
            amount: data.amount,
            sub: `was due ${esc(date(data.dueDate))}`,
          }),
        ],
      },
      {
        label: "Bank transfer",
        blocks: [
          facts(t, [
            { label: "Account holder", value: esc(data.bank.accountHolder || "") },
            { label: "IBAN", value: esc(data.bank.iban || ""), mono: true },
            { label: "BIC", value: esc(data.bank.bic || ""), mono: true },
            { label: "Reference", value: esc(data.reference), mono: true, emphasis: true },
          ]),
          notice(t, {
            title: "Already paid?",
            body: "Then it is very likely a transfer that reached us without the reference, and we simply could not tell whose it was. Reply with the date and amount and we will match it by hand.",
          }),
        ],
      },
    ],
    close: {
      note: data.finalNotice
        ? "If we do not hear from you we will close the application in a few weeks. Nothing is owed if you have changed your mind — just let us know."
        : "If you would rather pay in cash, bring it to the next event and we will record it there.",
    },
  };
};

/** Weekly committee summary. */
export const adminPaymentDigest = (
  ctx: MessageContext,
  data: {
    recorded: number;
    recordedTotal: number;
    outstanding: number;
    outstandingTotal: number;
    overdue: number;
    newApplications: number;
  }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Weekly summary — ${data.recorded} payments recorded`,
    previewText: `€${data.recordedTotal.toFixed(2)} in, €${data.outstandingTotal.toFixed(2)} outstanding.`,
    eyebrow: "Committee",
    title: "This week in payments",
    accentWord: "payments",
    lead: `${data.recorded} payment${data.recorded === 1 ? "" : "s"} recorded and ${data.outstanding} still awaited.`,
    sections: [
      {
        label: "Money in",
        blocks: [
          facts(t, [
            { label: "Payments recorded", value: String(data.recorded), emphasis: true },
            { label: "Value", value: `€${data.recordedTotal.toFixed(2)}` },
            { label: "New applications", value: String(data.newApplications) },
          ]),
        ],
      },
      {
        label: "Money owed",
        blocks: [
          facts(t, [
            { label: "Awaiting payment", value: String(data.outstanding), emphasis: true },
            { label: "Value", value: `€${data.outstandingTotal.toFixed(2)}` },
            { label: "Past due date", value: String(data.overdue) },
          ]),
        ],
      },
    ],
    close: {
      button: { label: "Open the payments ledger", href: absoluteUrl("/admin/payments") },
    },
  };
};
