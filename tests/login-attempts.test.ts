import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rateLimit: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { CAPTCHA_AFTER_FAILURES, LOGIN_FAILURE_WINDOW_MS } from "@/lib/login-challenge";
import {
  clearLoginFailures,
  isCaptchaRequired,
  recordLoginFailure,
} from "@/lib/login-attempts";

const rateLimit = prisma.rateLimit as unknown as {
  findMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
};

const KEYS = ["loginfail:admin:a@b.com", "loginfail:admin:ip:203.0.113.7"];

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.findMany.mockResolvedValue([]);
  rateLimit.findUnique.mockResolvedValue(null);
  rateLimit.upsert.mockResolvedValue({});
  rateLimit.update.mockResolvedValue({});
  rateLimit.deleteMany.mockResolvedValue({ count: 0 });
});

describe("isCaptchaRequired", () => {
  it("is false for an address nobody has failed against", async () => {
    await expect(isCaptchaRequired(KEYS)).resolves.toBe(false);
  });

  it("is true once a counter has reached the threshold", async () => {
    rateLimit.findMany.mockResolvedValue([{ count: CAPTCHA_AFTER_FAILURES }]);
    await expect(isCaptchaRequired(KEYS)).resolves.toBe(true);
  });

  it("is false while the counters are still below it", async () => {
    rateLimit.findMany.mockResolvedValue([{ count: 1 }, { count: 2 }]);
    await expect(isCaptchaRequired(KEYS)).resolves.toBe(false);
  });

  /** An expired row is a run of failures that has since gone quiet. */
  it("ignores counters whose window has passed", async () => {
    await isCaptchaRequired(KEYS);
    const where = rateLimit.findMany.mock.calls[0][0].where;
    expect(where.key).toEqual({ in: KEYS });
    expect(where.resetAt.gt).toBeInstanceOf(Date);
  });
});

describe("recordLoginFailure", () => {
  it("opens a counter for each key on the first failure", async () => {
    await recordLoginFailure(KEYS);

    expect(rateLimit.upsert).toHaveBeenCalledTimes(2);
    const call = rateLimit.upsert.mock.calls[0][0];
    expect(call.create.count).toBe(1);
    expect(call.update.count).toBe(1);
  });

  it("restarts a counter whose window has already passed", async () => {
    rateLimit.findUnique.mockResolvedValue({
      key: KEYS[0],
      count: 9,
      resetAt: new Date(Date.now() - 1000),
    });

    await recordLoginFailure([KEYS[0]]);

    expect(rateLimit.update).not.toHaveBeenCalled();
    expect(rateLimit.upsert.mock.calls[0][0].update.count).toBe(1);
  });

  /**
   * The window slides. A fixed one opened by the first failure would lapse
   * mid-attack, handing the script three free attempts every half hour.
   */
  it("counts up and pushes the window forward while attempts continue", async () => {
    rateLimit.findUnique.mockResolvedValue({
      key: KEYS[0],
      count: 2,
      resetAt: new Date(Date.now() + 60_000),
    });

    const before = Date.now();
    await recordLoginFailure([KEYS[0]]);

    const data = rateLimit.update.mock.calls[0][0].data;
    expect(data.count).toEqual({ increment: 1 });
    expect(data.resetAt.getTime()).toBeGreaterThanOrEqual(before + LOGIN_FAILURE_WINDOW_MS - 50);
  });

  /**
   * This runs on the way to rejecting a sign-in. A database hiccup must not
   * turn "wrong password" into a different failure — the difference is
   * something an attacker can read.
   */
  it("swallows a database failure rather than changing the sign-in error", async () => {
    rateLimit.findUnique.mockRejectedValue(new Error("connection lost"));
    await expect(recordLoginFailure(KEYS)).resolves.toBeUndefined();
  });
});

describe("clearLoginFailures", () => {
  it("wipes every counter for the attempt", async () => {
    await clearLoginFailures(KEYS);
    expect(rateLimit.deleteMany).toHaveBeenCalledWith({ where: { key: { in: KEYS } } });
  });

  it("does nothing when there is nothing to clear", async () => {
    await clearLoginFailures([]);
    expect(rateLimit.deleteMany).not.toHaveBeenCalled();
  });
});
