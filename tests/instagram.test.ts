import { describe, expect, it } from "vitest";
import { computeTokenExpiry, isTokenRefreshDue, parseReelsPage } from "@/lib/instagram";

describe("parseReelsPage", () => {
  it("keeps only REELS items, mapped to ParsedReel", () => {
    const parsed = parseReelsPage({
      data: [
        {
          id: "17999",
          caption: "Onam prep",
          media_type: "VIDEO",
          media_product_type: "REELS",
          media_url: "https://ig.example/video.mp4",
          thumbnail_url: "https://ig.example/thumb.jpg",
          permalink: "https://instagram.com/reel/abc",
          timestamp: "2026-08-01T10:00:00+0000",
        },
        {
          id: "18000",
          media_type: "IMAGE",
          media_product_type: "FEED",
          permalink: "https://instagram.com/p/def",
          timestamp: "2026-08-02T10:00:00+0000",
        },
      ],
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      igMediaId: "17999",
      caption: "Onam prep",
      permalink: "https://instagram.com/reel/abc",
      igThumbnailUrl: "https://ig.example/thumb.jpg",
      igMediaUrl: "https://ig.example/video.mp4",
      postedAt: new Date("2026-08-01T10:00:00+0000"),
    });
  });

  it("returns an empty array when there is no data field", () => {
    expect(parseReelsPage({})).toEqual([]);
  });

  it("falls back to the media url for the thumbnail when none is given", () => {
    const parsed = parseReelsPage({
      data: [
        {
          id: "1",
          media_type: "VIDEO",
          media_product_type: "REELS",
          media_url: "https://ig.example/video.mp4",
          permalink: "https://instagram.com/reel/xyz",
          timestamp: "2026-08-01T10:00:00+0000",
        },
      ],
    });
    expect(parsed[0].igThumbnailUrl).toBe("https://ig.example/video.mp4");
  });
});

describe("isTokenRefreshDue", () => {
  const now = new Date("2026-08-18T00:00:00Z");

  it("is due when there is no known expiry", () => {
    expect(isTokenRefreshDue(null, now)).toBe(true);
  });

  it("is not due with more than 14 days remaining", () => {
    expect(isTokenRefreshDue(new Date("2026-09-15T00:00:00Z"), now)).toBe(false);
  });

  it("is due within the 14-day window", () => {
    expect(isTokenRefreshDue(new Date("2026-08-25T00:00:00Z"), now)).toBe(true);
  });

  it("is due once already expired", () => {
    expect(isTokenRefreshDue(new Date("2026-08-01T00:00:00Z"), now)).toBe(true);
  });
});

describe("computeTokenExpiry", () => {
  it("adds the given number of seconds to now", () => {
    const now = new Date("2026-08-18T00:00:00Z");
    expect(computeTokenExpiry(5_184_000, now)).toEqual(new Date("2026-10-17T00:00:00Z"));
  });
});
