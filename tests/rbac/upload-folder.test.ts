import { describe, expect, it } from "vitest";
import { CONTRIBUTION_FOLDER_PREFIX, resolveUploadFolder } from "@/lib/rbac/upload-folder";

describe("resolveUploadFolder", () => {
  it("honours the requested folder for a publisher", () => {
    expect(
      resolveUploadFolder({ mayPublish: true, requested: "kerala-samajam/gallery" })
    ).toBe("kerala-samajam/gallery");
  });

  it("sandboxes a caller without the publish permission", () => {
    expect(
      resolveUploadFolder({ mayPublish: false, requested: "kerala-samajam/gallery" })
    ).toBe(`${CONTRIBUTION_FOLDER_PREFIX}misc`);
  });

  it("lets a non-publisher keep an explicit contribution folder", () => {
    const requested = `${CONTRIBUTION_FOLDER_PREFIX}album-42`;
    expect(resolveUploadFolder({ mayPublish: false, requested })).toBe(requested);
  });

  it("defaults to the gallery folder when nothing is requested", () => {
    expect(resolveUploadFolder({ mayPublish: true })).toBe("kerala-samajam/gallery");
  });

  it("sandboxes staff who lack gallery.media.upload", () => {
    // A Content Editor: staff, but never granted gallery publishing.
    expect(
      resolveUploadFolder({ mayPublish: false, requested: "kerala-samajam/gallery" })
    ).toBe(`${CONTRIBUTION_FOLDER_PREFIX}misc`);
  });
});
