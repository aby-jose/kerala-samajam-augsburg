/** Contact form. */

import type { MessageContext } from "../shell";
import { themed } from "../shell";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import { esc, facts, paragraph, quote, strong } from "../blocks";

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
  ctx: MessageContext,
  data: { name: string; email: string; subject: string; message: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Contact form: ${data.subject}`,
    previewText: `${data.name} wrote: ${data.message.slice(0, 120)}`,
    eyebrow: "Enquiry",
    title: "New message from the website",
    accentWord: "message",
    lead: `${strong(t, esc(data.name))} wrote in about ${esc(data.subject)}.`,
    sections: [
      {
        label: "Sender",
        blocks: [
          facts(t, [
            { label: "Name", value: esc(data.name), emphasis: true },
            { label: "Email", value: esc(data.email) },
            { label: "Subject", value: esc(data.subject) },
          ]),
        ],
      },
      { label: "Their message", blocks: [quote(t, data.message)] },
    ],
    close: {
      button: { label: `Reply to ${esc(data.name)}`, href: `mailto:${data.email}` },
      note: "The sender has been sent an automatic acknowledgement.",
    },
  };
};

export const contactAcknowledgement = (
  ctx: MessageContext,
  data: { name: string; subject: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: "We got your message",
    previewText: "Someone will come back to you within a day or two.",
    eyebrow: "Message received",
    title: `Namaskaram, ${data.name}`,
    accentWord: data.name,
    lead: `Thank you for writing to us about ${strong(t, esc(data.subject))}. Your message has reached the committee.`,
    sections: [
      {
        blocks: [
          paragraph(
            t,
            "We are a volunteer association, so replies come from people fitting this around their jobs — usually within one or two working days."
          ),
          paragraph(
            t,
            "There is no need to write again in the meantime; this is not an automated queue, and a second message will not make it move faster."
          ),
        ],
      },
    ],
    close: {
      button: { label: "Back to the website", href: absoluteUrl("/") },
    },
  };
};
