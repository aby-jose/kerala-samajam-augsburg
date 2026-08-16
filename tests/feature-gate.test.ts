import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks -------------------------------------------------------------
//
// `feature-gate.ts` reaches for three things: the stored config, the admin
// session, and Next's `notFound`. All three are stubbed so the decisions can
// be exercised without a database or a request context.

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    // Next's own `notFound()` throws to unwind the render. Mirroring that
    // matters: a stub that merely records the call would let a page keep
    // running past the gate in a test while 404ing in production.
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/lib/config-utils", () => ({ getConfig: vi.fn() }));
vi.mock("@/lib/guards", () => ({ getAdminUser: vi.fn() }));

import { notFound } from "next/navigation";
import { getConfig } from "@/lib/config-utils";
import { getAdminUser } from "@/lib/guards";
import {
  assertFeature,
  featureDisabledMessage,
  isFeatureEnabled,
  isMaintenanceLocked,
  requireFeature,
} from "@/lib/feature-gate";

const mockedGetConfig = vi.mocked(getConfig);
const mockedGetAdminUser = vi.mocked(getAdminUser);
const mockedNotFound = vi.mocked(notFound);

/** Only `features` matters here; the rest of SiteConfig is irrelevant. */
function configWith(features: Record<string, boolean>) {
  return {
    features: {
      enableRegistration: true,
      enableGallery: true,
      enableMembership: true,
      maintenanceMode: false,
      ...features,
    },
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetAdminUser.mockResolvedValue(null);
});

describe("isFeatureEnabled", () => {
  it("reads the flag for the key it was asked about", async () => {
    mockedGetConfig.mockResolvedValue(configWith({ enableGallery: false }));

    expect(await isFeatureEnabled("enableGallery")).toBe(false);
    expect(await isFeatureEnabled("enableMembership")).toBe(true);
    expect(await isFeatureEnabled("enableRegistration")).toBe(true);
  });
});

describe("requireFeature — the page gate", () => {
  it("returns quietly when the module is on", async () => {
    mockedGetConfig.mockResolvedValue(configWith({}));

    await expect(requireFeature("enableGallery")).resolves.toBeUndefined();
    expect(mockedNotFound).not.toHaveBeenCalled();
  });

  it("404s when the module is off", async () => {
    mockedGetConfig.mockResolvedValue(configWith({ enableGallery: false }));

    await expect(requireFeature("enableGallery")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockedNotFound).toHaveBeenCalled();
  });

  it("does not 404 a page whose own module is still on", async () => {
    mockedGetConfig.mockResolvedValue(configWith({ enableGallery: false }));

    await expect(requireFeature("enableMembership")).resolves.toBeUndefined();
    expect(mockedNotFound).not.toHaveBeenCalled();
  });
});

describe("assertFeature — the action gate", () => {
  it("returns quietly when the module is on", async () => {
    mockedGetConfig.mockResolvedValue(configWith({}));

    await expect(assertFeature("enableRegistration")).resolves.toBeUndefined();
  });

  it("throws a message naming the module when it is off", async () => {
    mockedGetConfig.mockResolvedValue(configWith({ enableRegistration: false }));

    await expect(assertFeature("enableRegistration")).rejects.toThrow(
      featureDisabledMessage("enableRegistration")
    );
  });

  it("names each module distinctly", () => {
    const messages = [
      featureDisabledMessage("enableRegistration"),
      featureDisabledMessage("enableGallery"),
      featureDisabledMessage("enableMembership"),
    ];

    expect(new Set(messages).size).toBe(3);
  });
});

describe("isMaintenanceLocked", () => {
  it("is unlocked while maintenance mode is off", async () => {
    mockedGetConfig.mockResolvedValue(configWith({ maintenanceMode: false }));

    expect(await isMaintenanceLocked()).toBe(false);
  });

  it("does not read the session while maintenance mode is off", async () => {
    // Every public request passes through this check. Reading the admin
    // session on all of them would add a token decrypt to the normal path for
    // a switch that is off virtually always.
    mockedGetConfig.mockResolvedValue(configWith({ maintenanceMode: false }));

    await isMaintenanceLocked();

    expect(mockedGetAdminUser).not.toHaveBeenCalled();
  });

  it("locks a visitor out while maintenance mode is on", async () => {
    mockedGetConfig.mockResolvedValue(configWith({ maintenanceMode: true }));
    mockedGetAdminUser.mockResolvedValue(null);

    expect(await isMaintenanceLocked()).toBe(true);
  });

  it("lets an administrator through so they can see what they published", async () => {
    mockedGetConfig.mockResolvedValue(configWith({ maintenanceMode: true }));
    mockedGetAdminUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });

    expect(await isMaintenanceLocked()).toBe(false);
  });

  it("locks the site independently of the module switches", async () => {
    mockedGetConfig.mockResolvedValue(
      configWith({ maintenanceMode: true, enableGallery: true })
    );

    expect(await isMaintenanceLocked()).toBe(true);
  });
});
