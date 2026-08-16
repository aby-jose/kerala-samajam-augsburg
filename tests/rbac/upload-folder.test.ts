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

  it("normalises a .. escape out of the contribution sandbox before checking the prefix", () => {
    // A bare startsWith on the unnormalised string would pass — it IS text
    // that starts with the contribution prefix — while actually resolving to
    // "branding/x", outside the sandbox entirely (the two ".." segments walk
    // back past "contributions" *and* "kerala-samajam").
    const escaping = `${CONTRIBUTION_FOLDER_PREFIX}../../branding/x`;
    expect(resolveUploadFolder({ mayPublish: false, requested: escaping })).toBe(
      `${CONTRIBUTION_FOLDER_PREFIX}misc`
    );
  });
});
