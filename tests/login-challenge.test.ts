import { describe, expect, it } from "vitest";

import {
  CAPTCHA_AFTER_FAILURES,
  CAPTCHA_REQUIRED,
  captchaRequiredFor,
  loginFailureKeys,
  normaliseClientIp,
  readChallengeField,
} from "@/lib/login-challenge";

describe("when a security code is demanded", () => {
  it("lets the first three failures through without one", () => {
    expect(captchaRequiredFor([0])).toBe(false);
    expect(captchaRequiredFor([1])).toBe(false);
    expect(captchaRequiredFor([2])).toBe(false);
  });

  it("demands one from the fourth attempt", () => {
    expect(captchaRequiredFor([CAPTCHA_AFTER_FAILURES])).toBe(true);
    expect(captchaRequiredFor([CAPTCHA_AFTER_FAILURES + 9])).toBe(true);
  });

  it("demands one if either counter has reached the threshold", () => {
    // The address is clean but the client has been failing against others —
    // which is what credential stuffing looks like from the server's side.
    expect(captchaRequiredFor([0, CAPTCHA_AFTER_FAILURES])).toBe(true);
  });

  it("asks for nothing when there are no counters at all", () => {
    expect(captchaRequiredFor([])).toBe(false);
  });

  it("uses a sentinel the login screens can match, not prose", () => {
    expect(CAPTCHA_REQUIRED).toBe("CAPTCHA_REQUIRED");
  });
});

describe("failure counter keys", () => {
  it("counts the address, case- and whitespace-insensitively", () => {
    expect(loginFailureKeys("admin", "  Admin@Example.COM ")).toEqual([
      "loginfail:admin:admin@example.com",
    ]);
  });

  it("keeps the two portals apart", () => {
    const [admin] = loginFailureKeys("admin", "a@b.com");
    const [publicKey] = loginFailureKeys("public", "a@b.com");
    expect(admin).not.toBe(publicKey);
  });

  it("counts the client as well as the address", () => {
    expect(loginFailureKeys("public", "a@b.com", "203.0.113.7")).toEqual([
      "loginfail:public:a@b.com",
      "loginfail:public:ip:203.0.113.7",
    ]);
  });

  it("takes the client from the head of an x-forwarded-for chain", () => {
    expect(loginFailureKeys("public", "a@b.com", "203.0.113.7, 70.41.3.18, 150.172.238.178")[1]).toBe(
      "loginfail:public:ip:203.0.113.7"
    );
  });

  /**
   * The important one. An "unknown" bucket is shared by every visitor, so
   * three failures anywhere would put a code in front of the whole site —
   * exactly the blanket friction this change exists to remove.
   */
  it("drops the client counter when there is no usable address", () => {
    for (const value of [undefined, null, "", "   ", "unknown", "UNKNOWN"]) {
      expect(loginFailureKeys("public", "a@b.com", value)).toEqual(["loginfail:public:a@b.com"]);
    }
  });

  it("does not collide with the sign-in attempt limiter's keys", () => {
    // `persistentRateLimit` owns `login:<portal>:<email>` in the same table.
    expect(loginFailureKeys("admin", "a@b.com")[0]).not.toBe("login:admin:a@b.com");
  });
});

describe("reading a challenge field off the request", () => {
  it("keeps a code the person actually typed, trimmed", () => {
    expect(readChallengeField("  ab12cd  ")).toBe("ab12cd");
  });

  /**
   * The regression this exists for. next-auth builds its request body with
   * `URLSearchParams`, which renders a missing value as the *string*
   * "undefined" rather than dropping the key. Read as truthy, that made a
   * sign-in with no code field on screen fail with "Invalid security code" —
   * for a code the person was never shown.
   */
  it("treats next-auth's stringified placeholders as no code at all", () => {
    expect(readChallengeField("undefined")).toBeNull();
    expect(readChallengeField("null")).toBeNull();
  });

  it("treats missing and blank as no code at all", () => {
    expect(readChallengeField(undefined)).toBeNull();
    expect(readChallengeField(null)).toBeNull();
    expect(readChallengeField("")).toBeNull();
    expect(readChallengeField("   ")).toBeNull();
  });
});

describe("normaliseClientIp", () => {
  it("lowercases so an IPv6 address counts as one client however it is cased", () => {
    expect(normaliseClientIp("2001:DB8::FF00:42:8329")).toBe("2001:db8::ff00:42:8329");
  });
});
