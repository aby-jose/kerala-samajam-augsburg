import { describe, expect, it } from "vitest";
import { defaultConfig, type SiteConfig } from "@/lib/config-schema";
import {
  establishedLine,
  foundingCaption,
  orgCity,
  orgLegalName,
} from "@/lib/org-identity";

/**
 * The helpers only ever read config, so each case is the default config with
 * the one field under test overridden.
 */
const withConfig = (patch: Partial<SiteConfig>): SiteConfig => ({
  ...defaultConfig,
  ...patch,
  legal: { ...defaultConfig.legal, ...patch.legal },
});

describe("orgCity", () => {
  it("returns the configured city", () => {
    expect(orgCity(withConfig({ legal: { ...defaultConfig.legal, city: "München" } }))).toBe("München");
  });

  it("falls back to Augsburg when the city is blank", () => {
    expect(orgCity(withConfig({ legal: { ...defaultConfig.legal, city: "" } }))).toBe("Augsburg");
  });

  it("falls back to Augsburg when the city is still a placeholder", () => {
    expect(orgCity(withConfig({ legal: { ...defaultConfig.legal, city: "{{STADT}}" } }))).toBe("Augsburg");
  });
});

describe("foundingCaption", () => {
  it("names the city and the founding year", () => {
    expect(foundingCaption(withConfig({ foundedYear: "2012" }))).toBe("Kerala in Augsburg, since 2012.");
  });

  it("follows the configured city", () => {
    const config = withConfig({ foundedYear: "1998", legal: { ...defaultConfig.legal, city: "Nürnberg" } });
    expect(foundingCaption(config)).toBe("Kerala in Nürnberg, since 1998.");
  });

  it("drops the founding clause when no year is set", () => {
    expect(foundingCaption(withConfig({ foundedYear: "" }))).toBe("Kerala in Augsburg.");
  });

  it("drops the founding clause when the year is absent from config", () => {
    expect(foundingCaption(withConfig({ foundedYear: undefined }))).toBe("Kerala in Augsburg.");
  });
});

describe("establishedLine", () => {
  it("returns an uppercase year and place for the dossier card", () => {
    expect(establishedLine(withConfig({ foundedYear: "2012" }))).toEqual({
      year: "ESTABLISHED 2012",
      place: "AUGSBURG, DEUTSCHLAND",
    });
  });

  it("omits the year line when no founding year is set", () => {
    expect(establishedLine(withConfig({ foundedYear: "" }))).toEqual({
      year: null,
      place: "AUGSBURG, DEUTSCHLAND",
    });
  });

  it("omits the country when it is still a placeholder", () => {
    const config = withConfig({
      foundedYear: "2012",
      legal: { ...defaultConfig.legal, country: "{{LAND}}" },
    });
    expect(establishedLine(config)).toEqual({ year: "ESTABLISHED 2012", place: "AUGSBURG" });
  });
});

describe("orgLegalName", () => {
  it("returns the registered entity name", () => {
    expect(orgLegalName(defaultConfig)).toBe("Kerala Samajam Augsburg e.V.");
  });

  it("falls back to the site name when the entity name is a placeholder", () => {
    const config = withConfig({
      siteName: "Kerala Samajam Augsburg",
      legal: { ...defaultConfig.legal, entityName: "{{VEREINSNAME}}" },
    });
    expect(orgLegalName(config)).toBe("Kerala Samajam Augsburg");
  });

  it("falls back to the site name when the entity name is blank", () => {
    const config = withConfig({
      siteName: "KSA",
      legal: { ...defaultConfig.legal, entityName: "" },
    });
    expect(orgLegalName(config)).toBe("KSA");
  });
});
