import { describe, expect, it } from "vitest";
import { defaultConfig } from "@/lib/config-schema";
import { organizationJsonLd } from "@/lib/structured-data";

describe("organizationJsonLd foundingDate", () => {
  it("publishes the configured founding year", () => {
    const jsonLd = organizationJsonLd({ ...defaultConfig, foundedYear: "2012" }, "https://ksaugsburg.de");
    expect(jsonLd.foundingDate).toBe("2012");
  });

  it("omits foundingDate entirely when no year is set", () => {
    const jsonLd = organizationJsonLd({ ...defaultConfig, foundedYear: "" }, "https://ksaugsburg.de");
    expect(jsonLd).not.toHaveProperty("foundingDate");
  });
});
