/** Gallery contribution moderation. */

import type { EmailContext } from "../layout";
import { themed } from "../layout";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import { button, dataCard, esc, paragraph, quote, stack, strong } from "../components";

export const contributionAdminNotice = (
  ctx: EmailContext,
  data: { uploaderName: string; albumTitle: string; count?: number }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `New photographs for ${data.albumTitle}`,
    previewText: `${data.uploaderName} contributed to ${data.albumTitle} and it needs review.`,
    eyebrow: "Committee",
    tone: "warning",
    title: "A contribution is waiting",
    body: dataCard(t, {
      title: "Submission",
      rows: [
        { label: "From", value: esc(data.uploaderName), emphasis: true },
        { label: "Album", value: esc(data.albumTitle) },
        data.count ? { label: "Items", value: String(data.count) } : null,
      ],
      footnote: "Nothing is public until you approve it.",
    }),
    action: button(t, "Review the contribution", absoluteUrl("/admin/gallery/contributions")),
  };
};

export const contributionApproved = (
  ctx: EmailContext,
  data: { name: string; albumTitle: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `Your photographs are live — ${data.albumTitle}`,
    previewText: "Approved and published to the gallery. Thank you for sharing.",
    eyebrow: "Published",
    tone: "success",
    title: "Your photographs are published",
    lead: `${esc(data.name)}, what you shared for ${strong(t, esc(data.albumTitle))} is approved and now visible to the whole community.`,
    body: paragraph(
      t,
      "Thank you for adding your view of the day. The albums are much better for having more than one camera in them."
    ),
    action: button(t, "See it in the gallery", absoluteUrl("/gallery")),
  };
};

export const contributionRejected = (
  ctx: EmailContext,
  data: { name: string; albumTitle: string; reason?: string }
): TemplateOutput => {
  const t = themed(ctx);
  return {
    subject: `About your contribution to ${data.albumTitle}`,
    previewText: "We were not able to publish this one.",
    eyebrow: "Contribution update",
    tone: "neutral",
    title: "We could not publish this one",
    lead: `${esc(data.name)}, thank you for submitting to ${strong(t, esc(data.albumTitle))}. We were not able to include it in the album.`,
    body: stack([
      data.reason ? quote(t, data.reason) : null,
      paragraph(
        t,
        "This is usually about image quality or someone in the frame who has not consented to being photographed — rarely about the picture itself. Please do keep contributing."
      ),
    ]),
    action: button(t, "Share something else", absoluteUrl("/gallery"), { variant: "secondary" }),
  };
};
