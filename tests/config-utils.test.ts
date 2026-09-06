import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { config: { findUnique: vi.fn() } },
}));

// unstable_cache: identity passthrough. The real one caches across a 10s
// window keyed by tag, not by JS module instance — vi.resetModules() below
// does not reset it, so without this mock a value resolved in an earlier
// test case would still be served to a later one that mocks a different
// prisma return.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
}));

// `getConfig` is wrapped in React's `cache()`, which memoises per request. In
// a test there is no request scope, so each call re-runs the loader — but the
// module is re-imported per test anyway to keep that guarantee independent of
// React's implementation.
import { prisma } from "@/lib/prisma";
import { defaultConfig } from "@/lib/config-schema";

const mockedFindUnique = vi.mocked(prisma.config.findUnique);

async function loadConfig() {
  vi.resetModules();
  const { getConfig } = await import("@/lib/config-utils");
  return getConfig();
}

describe("getConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("switches the launch ceremony off for a config saved before it existed", async () => {
    const storedFeatures: Partial<typeof defaultConfig.features> = { ...defaultConfig.features };
    delete storedFeatures.launchCeremony;
    mockedFindUnique.mockResolvedValue({
      key: "current",
      value: { ...defaultConfig, features: storedFeatures },
    } as any);

    const config = await loadConfig();

    expect(config.features.launchCeremony).toBe(false);
  });

  it("returns the defaults when nothing is stored", async () => {
    mockedFindUnique.mockResolvedValue(null as any);

    const config = await loadConfig();

    expect(config.membership).toEqual(defaultConfig.membership);
  });

  it("fills in a group added after the config was last saved", async () => {
    // A config row written before the family-size limits existed has no
    // `membership` key at all. Without the per-group merge the form modal
    // would read `membership.maxFamilyAdults` off undefined and crash.
    const { membership, ...storedWithoutMembership } = defaultConfig;
    mockedFindUnique.mockResolvedValue({
      key: "current",
      value: storedWithoutMembership,
    } as any);

    const config = await loadConfig();

    expect(config.membership).toEqual(defaultConfig.membership);
  });

  it("keeps stored family limits over the defaults", async () => {
    mockedFindUnique.mockResolvedValue({
      key: "current",
      value: {
        ...defaultConfig,
        membership: { maxFamilyAdults: 3, maxFamilyChildren: 8 },
      },
    } as any);

    const config = await loadConfig();

    expect(config.membership).toEqual({ maxFamilyAdults: 3, maxFamilyChildren: 8 });
  });

  it("fills in a single missing key within the membership group", async () => {
    mockedFindUnique.mockResolvedValue({
      key: "current",
      value: { ...defaultConfig, membership: { maxFamilyChildren: 9 } },
    } as any);

    const config = await loadConfig();

    expect(config.membership).toEqual({
      maxFamilyAdults: defaultConfig.membership.maxFamilyAdults,
      maxFamilyChildren: 9,
    });
  });
});
