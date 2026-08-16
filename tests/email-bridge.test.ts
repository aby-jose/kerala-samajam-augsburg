/**
 * The dual-render bridge.
 *
 * While the 44 templates migrate from `EmailDocument` to `Message`, both
 * shells have to render side by side. `renderFor` picks one by looking for
 * `sections`, which only a `Message` carries. These two tests are what stop a
 * half-migrated module from silently sending every message through the wrong
 * shell.
 *
 * Deleted in Task 9, once nothing returns an `EmailDocument`.
 */

import { describe, expect, it } from "vitest";

import { defaultConfig } from "../src/lib/config-schema";
import { renderFor } from "../src/lib/email/send";
import type { EmailContext } from "../src/lib/email/layout";

const ctx: EmailContext = {
  siteName: defaultConfig.siteName,
  contactEmail: defaultConfig.contactEmail,
  branding: { primaryColor: defaultConfig.branding.primaryColor },
  legal: defaultConfig.legal,
};

describe("renderFor", () => {
  it("routes a Message to the new shell", () => {
    const html = renderFor(ctx, {
      subject: "s",
      previewText: "p",
      eyebrow: "e",
      title: "Payment received",
      accentWord: "received",
      sections: [],
    });

    // The SVG backdrop and the light-only declaration exist only in the new shell.
    expect(html).toContain("data:image/svg+xml");
    expect(html).toContain('name="color-scheme" content="light"');
  });

  it("routes an EmailDocument to the old shell", () => {
    const html = renderFor(ctx, {
      subject: "s",
      previewText: "p",
      eyebrow: "e",
      title: "Old",
    });

    expect(html).not.toContain("data:image/svg+xml");
  });

  it("treats an empty sections array as a Message, not a document", () => {
    // The discriminator is the presence of the array, not its length — a
    // message with no body panels is still a message.
    const html = renderFor(ctx, {
      subject: "s",
      previewText: "p",
      eyebrow: "e",
      title: "Empty",
      sections: [],
    });

    expect(html).toContain("data:image/svg+xml");
  });
});
