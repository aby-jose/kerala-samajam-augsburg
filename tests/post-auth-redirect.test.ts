import { describe, expect, it } from "vitest";

import { postAuthRedirect } from "@/lib/post-auth-redirect";

describe("postAuthRedirect", () => {
  it("sends an admin back to the admin login", () => {
    expect(postAuthRedirect("ADMIN")).toBe("/admin/login");
  });

  it("sends everyone else to the public sign-in", () => {
    expect(postAuthRedirect("MEMBER")).toBe("/?auth=login");
  });

  it("defaults to the public sign-in when no role is known", () => {
    expect(postAuthRedirect(undefined)).toBe("/?auth=login");
  });
});
