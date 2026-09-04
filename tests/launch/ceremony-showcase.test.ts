import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ceremonyFeatures, qrTarget } from "@/lib/ceremony-showcase";
import { defaultConfig } from "@/lib/config-schema";

const ORIGINAL = process.env.NEXT_PUBLIC_APP_URL;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.SITE_URL;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL;
});

describe("qrTarget", () => {
  it("refuses to produce a QR when no site URL is configured", () => {
    const target = qrTarget();
    expect(target.ok).toBe(false);
  });

  it("refuses to produce a QR pointing at localhost", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(qrTarget().ok).toBe(false);
  });

  it("names the missing variable so an operator can fix it", () => {
    const target = qrTarget();
    expect(target.ok).toBe(false);
    if (!target.ok) expect(target.reason).toContain("NEXT_PUBLIC_APP_URL");
  });

  it("normalises a configured URL to https with no trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://keralasamajam.de/";
    const target = qrTarget();
    expect(target).toEqual({ ok: true, url: "https://keralasamajam.de" });
  });
});

describe("ceremonyFeatures", () => {
  it("lists every feature when all modules are on", () => {
    const config = {
      ...defaultConfig,
      features: {
        ...defaultConfig.features,
        enableGallery: true,
        enableMembership: true,
      },
    };
    expect(ceremonyFeatures(config).map((f) => f.key)).toEqual([
      "events",
      "membership",
      "gallery",
      "about",
    ]);
  });

  it("does not advertise membership on stage when the module is off", () => {
    const config = {
      ...defaultConfig,
      features: { ...defaultConfig.features, enableMembership: false },
    };
    expect(ceremonyFeatures(config).map((f) => f.key)).not.toContain("membership");
  });

  it("does not advertise the gallery when the module is off", () => {
    const config = {
      ...defaultConfig,
      features: { ...defaultConfig.features, enableGallery: false },
    };
    expect(ceremonyFeatures(config).map((f) => f.key)).not.toContain("gallery");
  });

  it("always keeps events and about, which have no module switch", () => {
    const config = {
      ...defaultConfig,
      features: {
        ...defaultConfig.features,
        enableGallery: false,
        enableMembership: false,
      },
    };
    expect(ceremonyFeatures(config).map((f) => f.key)).toEqual(["events", "about"]);
  });
});
