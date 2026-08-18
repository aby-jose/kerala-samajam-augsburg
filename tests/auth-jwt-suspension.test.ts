import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the jwt callback's re-check branch is under test here, and it only
// ever touches `prisma.user.findUnique` — everything else `auth.ts` imports
// (bcrypt, the OAuth providers, the adapter, captcha, rate-limit) is real but
// unexercised by that branch.
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { publicAuthOptions } from "@/lib/auth";

const mockedFindUser = vi.mocked(prisma.user.findUnique);

const jwtCallback = publicAuthOptions.callbacks!.jwt!;

/** A token whose role was last confirmed long enough ago to force a re-check. */
function staleToken(role: string) {
  return {
    id: "member-1",
    role,
    roleCheckedAt: 0, // epoch — always older than the refresh interval
    iat: Math.floor(Date.now() / 1000),
  } as never;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("jwt callback — suspended/deleted accounts are fully evicted on re-check", () => {
  it("clears both role and id when the account is now suspended", async () => {
    mockedFindUser.mockResolvedValue({
      role: "SUSPENDED_MEMBER",
      emailVerified: new Date(),
      passwordChangedAt: null,
    } as never);

    const result = await jwtCallback({ token: staleToken("MEMBER") } as never);

    // `id` must go too: isSuspended() (guards.ts) only checks the role
    // *prefix*, and `undefined` fails that check just like a normal role
    // would — a role-only clear leaves getCurrentUser() treating the session
    // as a valid, unsuspended signed-in user for as long as the token lives.
    expect(result.role).toBeUndefined();
    expect(result.id).toBeUndefined();
  });

  it("clears both role and id when the account no longer exists", async () => {
    mockedFindUser.mockResolvedValue(null as never);

    const result = await jwtCallback({ token: staleToken("MEMBER") } as never);

    expect(result.role).toBeUndefined();
    expect(result.id).toBeUndefined();
  });

  it("keeps a still-active account's session intact", async () => {
    mockedFindUser.mockResolvedValue({
      role: "MEMBER",
      emailVerified: new Date(),
      passwordChangedAt: null,
    } as never);

    const result = await jwtCallback({ token: staleToken("MEMBER") } as never);

    expect(result.role).toBe("MEMBER");
    expect(result.id).toBe("member-1");
  });
});
