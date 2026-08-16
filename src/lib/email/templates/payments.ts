/**
 * Money.
 *
 * There is no payment gateway: everything here describes a transfer a member
 * makes themselves, or an administrator's statement that one arrived. That
 * asymmetry is why "here is what you owe" and "we have your money" are two
 * separate templates rather than one message that assumes the payment already
 * happened.
 */

import type { EmailContext } from "../layout";
import { themed } from "../layout";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import {
  amountCard,
  button,
  dataCard,
  esc,
  note,
  notice,
  paragraph,
  stack,
  strong,
} from "../components";

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
  ctx: EmailContext,
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
    subject: `Payment details for your ${data.planName} membership`,
    previewText: `€${data.amount.toFixed(2)} due by ${date(data.dueDate)}. Reference ${data.reference}.`,
    eyebrow: "Payment due",
    title: "How to pay",
    lead: `${esc(data.name)}, thank you for joining. To activate your ${strong(t, esc(data.planName))} membership, please send the amount below by ${strong(t, esc(date(data.dueDate)))}.`,
    body: stack([
      amountCard(t, {
        caption: "Amount due",
        amount: data.amount,
        sub: `by ${esc(date(data.dueDate))}`,
      }),
      byCash
        ? notice(t, {
            title: "You chose to pay in cash",
            body: "Bring the amount to the next committee meeting or event and we will record it on the spot. If you would rather transfer it after all, the details are below.",
            tone: "brand",
          })
        : null,
      dataCard(t, {
        title: "Bank transfer",
        rows: [
          { label: "Account holder", value: esc(data.bank.accountHolder || "") },
          { label: "Bank", value: esc(data.bank.bankName || "") },
          { label: "IBAN", value: esc(data.bank.iban || ""), mono: true },
          { label: "BIC", value: esc(data.bank.bic || ""), mono: true },
          { label: "Reference", value: esc(data.reference), mono: true, emphasis: true },
        ],
      }),
      notice(t, {
        title: "Quote the reference exactly",
        body: "It is the only thing that tells us which transfer belongs to which member. Without it your payment sits unmatched and your membership stays inactive.",
        tone: "warning",
      }),
      paragraph(
        t,
        `${strong(t, "Your membership starts on the day we record your payment")}, and runs a full term from that date. We will email a receipt with the exact dates once it lands. Your invoice is attached to this email.`
      ),
    ]),
    action: button(t, "View my membership", absoluteUrl("/profile"), { variant: "secondary" }),
  };
};

/** Confirmation that a membership payment arrived, with the receipt attached. */
export const membershipPaymentReceived = (
  ctx: EmailContext,
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
    subject: `Payment received — your membership is active`,
    previewText: `We have your €${data.amount.toFixed(2)}. Your membership runs to ${date(data.endDate)}.`,
    eyebrow: "Receipt",
    tone: "success",
    title: "Payment received",
    lead: `${esc(data.name)}, we have recorded your payment of ${strong(t, `€${data.amount.toFixed(2)}`)} for the ${strong(t, esc(data.planName))} membership. It is active from today.`,
    body: stack([
      dataCard(t, {
        title: "Your membership term",
        tone: "success",
        rows: [
          { label: "Plan", value: esc(data.planName) },
          { label: "Amount", value: `€${data.amount.toFixed(2)}` },
          { label: "Member since", value: esc(date(data.startDate)) },
          { label: "Valid until", value: esc(date(data.endDate)), emphasis: true },
          { label: "Term", value: esc(data.term) },
          data.reference ? { label: "Reference", value: esc(data.reference), mono: true } : null,
        ],
        footnote: "Your receipt is attached as a PDF — keep it for your records.",
      }),
    ]),
    action: button(t, "Go to my profile", absoluteUrl("/profile")),
    note: note(t, "We will remind you before the term is up."),
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
  ctx: EmailContext,
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
    tone: "success",
    title: "Payment received",
    lead: `${esc(data.name)}, we have recorded your payment for ${strong(t, esc(data.eventTitle))}. There is nothing left to settle — just bring your ticket.`,
    body: stack([
      amountCard(t, { caption: "Paid in full", amount: data.amount, tone: "success" }),
      dataCard(t, {
        title: "Receipt",
        rows: [
          { label: "Event", value: esc(data.eventTitle) },
          { label: "Method", value: esc(methodLabel) },
          { label: "Received", value: esc(date(data.paidAt)) },
          { label: "Ticket", value: esc(data.ticketId), mono: true, emphasis: true },
          data.reference ? { label: "Reference", value: esc(data.reference), mono: true } : null,
        ],
        footnote:
          "Treat this email as your receipt. Your original ticket PDF is still the one to bring — it is valid whether or not it was paid when it was issued.",
      }),
    ]),
    action: button(t, "View event details", absoluteUrl(`/events/${data.eventSlug}`)),
  };
};

/** An administrator undid a recorded payment. Rare, and worth explaining. */
export const eventPaymentReverted = (
  ctx: EmailContext,
  data: { name: string; eventTitle: string; eventSlug: string; ticketId: string; amount: number }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Correction: payment for ${data.eventTitle}`,
    previewText: "We have reversed a payment record on your registration.",
    eyebrow: "Correction",
    tone: "warning",
    title: "We corrected our records",
    lead: `${esc(data.name)}, we had recorded a payment of ${strong(t, `€${data.amount.toFixed(2)}`)} against your registration for ${strong(t, esc(data.eventTitle))}, and that entry has been reversed.`,
    body: stack([
      paragraph(
        t,
        "This almost always means a bookkeeping mix-up on our side rather than anything to do with you — for example, a transfer matched to the wrong registration."
      ),
      dataCard(t, {
        title: "Your registration",
        rows: [
          { label: "Event", value: esc(data.eventTitle) },
          { label: "Ticket", value: esc(data.ticketId), mono: true, emphasis: true },
          { label: "Balance", value: `€${data.amount.toFixed(2)} outstanding` },
        ],
      }),
      notice(t, {
        title: "Already paid?",
        body: "Reply to this email with the date and reference and we will fix it straight away. Otherwise the desk will ask for it at the door.",
        tone: "warning",
      }),
    ]),
    action: button(t, "View event details", absoluteUrl(`/events/${data.eventSlug}`), {
      variant: "secondary",
    }),
  };
};

/** The due date has passed. Firm about the facts, easy about the tone. */
export const paymentOverdue = (
  ctx: EmailContext,
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
      ? `Second reminder: your ${data.planName} membership payment`
      : `Reminder: your ${data.planName} membership payment`,
    previewText: `€${data.amount.toFixed(2)} was due on ${date(data.dueDate)}. Reference ${data.reference}.`,
    eyebrow: data.finalNotice ? "Second reminder" : "Payment reminder",
    tone: "warning",
    title: data.finalNotice ? "A second reminder" : "A gentle reminder",
    lead: `${esc(data.name)}, we have not yet been able to match a payment for your ${strong(t, esc(data.planName))} membership, which was due ${strong(t, `${data.daysOverdue} days ago`)}. Your membership will not start until it arrives.`,
    body: stack([
      amountCard(t, {
        caption: "Still outstanding",
        amount: data.amount,
        tone: "warning",
        sub: `was due ${esc(date(data.dueDate))}`,
      }),
      dataCard(t, {
        title: "Bank transfer",
        rows: [
          { label: "Account holder", value: esc(data.bank.accountHolder || "") },
          { label: "IBAN", value: esc(data.bank.iban || ""), mono: true },
          { label: "BIC", value: esc(data.bank.bic || ""), mono: true },
          { label: "Reference", value: esc(data.reference), mono: true, emphasis: true },
        ],
      }),
      notice(t, {
        title: "Already paid?",
        body: "Then it is very likely a transfer that reached us without the reference, and we simply could not tell whose it was. Reply with the date and amount and we will match it by hand.",
        tone: "neutral",
      }),
    ]),
    note: note(
      t,
      data.finalNotice
        ? "If we do not hear from you we will close the application in a few weeks. Nothing is owed if you have changed your mind — just let us know."
        : "If you would rather pay in cash, bring it to the next event and we will record it there."
    ),
  };
};

/** Weekly committee summary. */
export const adminPaymentDigest = (
  ctx: EmailContext,
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
    previewText: `€${data.recordedTotal.toFixed(2)} recorded this week, €${data.outstandingTotal.toFixed(2)} outstanding.`,
    eyebrow: "Committee",
    tone: data.overdue > 0 ? "warning" : "neutral",
    title: "This week",
    body: stack([
      dataCard(t, {
        title: "Money in",
        tone: "success",
        rows: [
          { label: "Payments recorded", value: String(data.recorded), emphasis: true },
          { label: "Value", value: `€${data.recordedTotal.toFixed(2)}` },
          { label: "New applications", value: String(data.newApplications) },
        ],
      }),
      dataCard(t, {
        title: "Money owed",
        tone: data.overdue > 0 ? "warning" : "neutral",
        rows: [
          { label: "Awaiting payment", value: String(data.outstanding), emphasis: true },
          { label: "Value", value: `€${data.outstandingTotal.toFixed(2)}` },
          { label: "Past due date", value: String(data.overdue) },
        ],
      }),
    ]),
    action: button(t, "Open the payments ledger", absoluteUrl("/admin/payments")),
  };
};
