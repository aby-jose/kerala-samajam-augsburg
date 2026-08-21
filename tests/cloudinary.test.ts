import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudinary", () => ({
  v2: {
    config: vi.fn(),
    uploader: { destroy: vi.fn() },
  },
}));

import { v2 as cloudinaryV2 } from "cloudinary";
import { deleteFromCloudinary } from "@/lib/cloudinary";

const mockedDestroy = vi.mocked(cloudinaryV2.uploader.destroy);

// deleteFromCloudinary has to recover both the resource_type and public_id
// from a stored secure_url — reel caching (unlike gallery uploads) never
// keeps the public_id Cloudinary returned at upload time.
describe("deleteFromCloudinary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("destroys a video asset using the resource_type and public_id parsed from the URL", async () => {
    await deleteFromCloudinary(
      "https://res.cloudinary.com/demo/video/upload/v1699999999/reels/abc123.mp4"
    );

    expect(mockedDestroy).toHaveBeenCalledWith("reels/abc123", { resource_type: "video" });
  });

  it("destroys an image asset the same way", async () => {
    await deleteFromCloudinary(
      "https://res.cloudinary.com/demo/image/upload/v1699999999/reels/thumb.jpg"
    );

    expect(mockedDestroy).toHaveBeenCalledWith("reels/thumb", { resource_type: "image" });
  });

  it("handles a URL with no version segment", async () => {
    await deleteFromCloudinary("https://res.cloudinary.com/demo/video/upload/reels/abc123.mp4");

    expect(mockedDestroy).toHaveBeenCalledWith("reels/abc123", { resource_type: "video" });
  });

  it("skips a URL it can't parse instead of throwing", async () => {
    await expect(
      deleteFromCloudinary("https://example.com/not-cloudinary.mp4")
    ).resolves.toBeUndefined();

    expect(mockedDestroy).not.toHaveBeenCalled();
  });

  it("swallows a destroy failure instead of throwing — best-effort cleanup", async () => {
    mockedDestroy.mockRejectedValueOnce(new Error("boom"));

    await expect(
      deleteFromCloudinary("https://res.cloudinary.com/demo/video/upload/v1/reels/abc123.mp4")
    ).resolves.toBeUndefined();
  });
});
