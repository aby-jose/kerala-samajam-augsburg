/** Contact form. */

import type { EmailContext } from "../layout";
import { themed } from "../layout";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import { button, dataCard, esc, note, paragraph, quote, stack, strong } from "../components";

/**
 * The committee's copy.
 *
 * Every field here is attacker-controlled — the form is open to the public —
 * so all of them go through `esc`. The previous version escaped the name, the
 * subject and the message but interpolated the email address raw, which is the
 * one field a sender can most easily use to smuggle markup into a committee
 * member's inbox.
 */
export const contactAdminNotice = (
  ctx: EmailContext,
  data: { name: string; email: string; subject: string; message: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Contact form: ${data.subject}`,
    previewText: `${data.name} wrote: ${data.message.slice(0, 120)}`,
    eyebrow: "Enquiry",
    tone: "neutral",
    title: "New message from the website",
    body: stack([
      dataCard(t, {
        title: "Sender",
        rows: [
          { label: "Name", value: esc(data.name), emphasis: true },
          { label: "Email", value: esc(data.email) },
          { label: "Subject", value: esc(data.subject) },
        ],
      }),
      quote(t, data.message),
    ]),
    action: button(t, `Reply to ${esc(data.name)}`, `mailto:${data.email}`),
    note: note(t, "The sender has been sent an automatic acknowledgement."),
  };
};

export const contactAcknowledgement = (
  ctx: EmailContext,
  data: { name: string; subject: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `We got your message — ${ctx.siteName}`,
    previewText: "Received. Someone will come back to you within a day or two.",
    eyebrow: "Message received",
    tone: "success",
    title: `Namaskaram, ${data.name}`,
    lead: `Thank you for writing to us about ${strong(t, esc(data.subject))}. Your message has reached the committee.`,
    body: stack([
      paragraph(
        t,
        "We are a volunteer association, so replies come from people fitting this around their jobs — usually within one or two working days."
      ),
      paragraph(
        t,
        "There is no need to write again in the meantime; this is not an automated queue, and a second message will not make it move faster."
      ),
    ]),
    action: button(t, "Back to the website", absoluteUrl("/"), { variant: "secondary" }),
  };
};
