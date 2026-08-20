import { describe, expect, it } from "vitest";
import { eventSponsorSchema, eventSchema } from "@/lib/schemas";

describe("eventSponsorSchema", () => {
  it("accepts a sponsor with name, logo, and website", () => {
    const result = eventSponsorSchema.safeParse({
      name: "Kerala Spice Co.",
      logoUrl: "https://res.cloudinary.com/demo/image/upload/logo.png",
      websiteUrl: "https://example.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a sponsor with no website", () => {
    const result = eventSponsorSchema.safeParse({
      name: "Kerala Spice Co.",
      logoUrl: "https://res.cloudinary.com/demo/image/upload/logo.png",
      websiteUrl: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a sponsor with no name", () => {
    const result = eventSponsorSchema.safeParse({
      name: "",
      logoUrl: "https://res.cloudinary.com/demo/image/upload/logo.png",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a sponsor with no logo", () => {
    const result = eventSponsorSchema.safeParse({
      name: "Kerala Spice Co.",
      logoUrl: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed website URL", () => {
    const result = eventSponsorSchema.safeParse({
      name: "Kerala Spice Co.",
      logoUrl: "https://res.cloudinary.com/demo/image/upload/logo.png",
      websiteUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a javascript: website URL", () => {
    const result = eventSponsorSchema.safeParse({
      name: "Kerala Spice Co.",
      logoUrl: "https://res.cloudinary.com/demo/image/upload/logo.png",
      websiteUrl: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });
});

describe("eventSchema sponsors field", () => {
  const baseEvent = {
    title: "Onam Celebration 2026",
    slug: "onam-celebration-2026",
    description: "A community celebration.",
    date: "2026-09-15",
    location: "Community Hall",
  };

  it("defaults to an empty sponsor list when omitted", () => {
    const result = eventSchema.parse(baseEvent);
    expect(result.sponsors).toEqual([]);
  });

  it("accepts a populated sponsor list", () => {
    const result = eventSchema.parse({
      ...baseEvent,
      sponsors: [
        {
          name: "Kerala Spice Co.",
          logoUrl: "https://res.cloudinary.com/demo/image/upload/logo.png",
          websiteUrl: "",
        },
      ],
    });
    expect(result.sponsors).toHaveLength(1);
  });

  it("rejects an event whose sponsor list has an invalid entry", () => {
    const result = eventSchema.safeParse({
      ...baseEvent,
      sponsors: [{ name: "", logoUrl: "" }],
    });
    expect(result.success).toBe(false);
  });
});
