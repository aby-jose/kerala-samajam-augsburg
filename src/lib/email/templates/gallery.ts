/** Gallery contribution moderation. */

import type { MessageContext } from "../shell";
import { themed } from "../shell";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import { esc, facts, paragraph, quote, strong } from "../blocks";

export const contributionAdminNotice = (
  ctx: MessageContext,
  data: { uploaderName: string; albumTitle: string; count?: number }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `New photographs for ${data.albumTitle}`,
    previewText: `${data.uploaderName} contributed and it needs review.`,
    eyebrow: "Committee",
    title: "A contribution is waiting",
    accentWord: "waiting",
    lead: `${strong(t, esc(data.uploaderName))} has added photographs to ${esc(data.albumTitle)}.`,
    sections: [
      {
        label: "Submission",
        blocks: [
          facts(t, [
            { label: "From", value: esc(data.uploaderName), emphasis: true },
            { label: "Album", value: esc(data.albumTitle) },
            data.count ? { label: "Items", value: String(data.count) } : null,
          ]),
        ],
      },
    ],
    close: {
      button: {
        label: "Review the contribution",
        href: absoluteUrl("/admin/gallery/contributions"),
      },
      note: "Nothing is public until you approve it.",
    },
  };
};

export const contributionApproved = (
  ctx: MessageContext,
  data: { name: string; albumTitle: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Your photographs are live — ${data.albumTitle}`,
    previewText: "Approved and published to the gallery. Thank you for sharing.",
    eyebrow: "Published",
    title: "Your photographs are published",
    accentWord: "published",
    lead: `${esc(data.name)}, what you shared for ${strong(t, esc(data.albumTitle))} is approved and now visible to the whole community.`,
    sections: [
      {
        blocks: [
          paragraph(
            t,
            "Thank you for adding your view of the day. The albums are much better for having more than one camera in them."
          ),
        ],
      },
    ],
    close: {
      button: { label: "See it in the gallery", href: absoluteUrl("/gallery") },
    },
  };
};

export const contributionRejected = (
  ctx: MessageContext,
  data: { name: string; albumTitle: string; reason?: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `About your contribution to ${data.albumTitle}`,
    previewText: "We were not able to publish this one.",
    eyebrow: "Contribution update",
    title: "We could not publish this one",
    accentWord: "publish",
    lead: `${esc(data.name)}, thank you for submitting to ${strong(t, esc(data.albumTitle))}. We were not able to include it in the album.`,
    sections: [
      {
        blocks: [
          data.reason ? quote(t, data.reason) : null,
          paragraph(
            t,
            "This is usually about image quality or someone in the frame who has not consented to being photographed — rarely about the picture itself. Please do keep contributing."
          ),
        ],
      },
    ],
    close: {
      button: { label: "Share something else", href: absoluteUrl("/gallery") },
    },
  };
};
