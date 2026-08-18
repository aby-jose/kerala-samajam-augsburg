import { describe, expect, it } from "vitest";

import { validateChangePasswordForm } from "@/lib/change-password-form";

const VALID = {
  currentPassword: "the-current-password",
  newPassword: "a-perfectly-fine-new-password",
  confirmPassword: "a-perfectly-fine-new-password",
};

describe("validateChangePasswordForm", () => {
  it("accepts a well-formed submission", () => {
    expect(validateChangePasswordForm(VALID)).toBeNull();
  });

  it("requires the current password", () => {
    expect(validateChangePasswordForm({ ...VALID, currentPassword: "" })).toBe(
      "Enter your current password."
    );
  });

  it("requires the new password to meet the minimum length", () => {
    expect(
      validateChangePasswordForm({ ...VALID, newPassword: "short", confirmPassword: "short" })
    ).toBe("New password must be at least 12 characters.");
  });

  it("requires the confirmation to match", () => {
    expect(
      validateChangePasswordForm({ ...VALID, confirmPassword: "a-different-password-entirely" })
    ).toBe("New passwords do not match.");
  });
});
