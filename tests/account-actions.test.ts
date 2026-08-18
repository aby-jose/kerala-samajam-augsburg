import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("bcrypt", () => ({
  default: { compare: vi.fn(), hash: vi.fn().mockResolvedValue("hashed-password") },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/guards", () => ({
  requireStaff: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  persistentRateLimit: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendMail: vi.fn(),
  templates: { account: { passwordChanged: vi.fn() } },
}));

vi.mock("@/lib/upload-validation", () => ({
  validateUpload: vi.fn(),
}));

vi.mock("@/lib/cloudinary", () => ({
  uploadToCloudinary: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/guards";
import { persistentRateLimit } from "@/lib/rate-limit";
import { sendMail } from "@/lib/email";
import { validateUpload } from "@/lib/upload-validation";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { changePassword, updateAvatar } from "@/lib/account-actions";

const mockedCompare = vi.mocked(bcrypt.compare);
const mockedHash = vi.mocked(bcrypt.hash);
const mockedFindUniqueUser = vi.mocked(prisma.user.findUnique);
const mockedUpdateUser = vi.mocked(prisma.user.update);
const mockedCreateAuditLog = vi.mocked(prisma.auditLog.create);
const mockedRequireStaff = vi.mocked(requireStaff);
const mockedRateLimit = vi.mocked(persistentRateLimit);
const mockedSendMail = vi.mocked(sendMail);
const mockedValidateUpload = vi.mocked(validateUpload);
const mockedUploadToCloudinary = vi.mocked(uploadToCloudinary);

const ACTOR = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff Member",
  roleName: "Payments Clerk",
  permissions: new Set(),
  has: () => false,
};

const CURRENT_PASSWORD = "the-current-password";
const NEW_PASSWORD = "a-perfectly-fine-new-password";

beforeEach(() => {
  vi.resetAllMocks();
  mockedRequireStaff.mockResolvedValue(ACTOR as never);
  mockedRateLimit.mockResolvedValue({ ok: true, remaining: 4, resetAt: 0 });
  mockedFindUniqueUser.mockResolvedValue({
    id: "staff-1",
    email: "staff@example.com",
    name: "Staff Member",
    password: "hashed-current-password",
  } as never);
  mockedCompare.mockResolvedValue(true as never);
  mockedHash.mockResolvedValue("hashed-password" as never);
  mockedUpdateUser.mockResolvedValue({} as never);
  mockedCreateAuditLog.mockResolvedValue({} as never);
  mockedSendMail.mockResolvedValue({ ok: true } as never);
});

describe("changePassword", () => {
  it("rejects a new password that is too short", async () => {
    const result = await changePassword(CURRENT_PASSWORD, "short");

    expect(result).toEqual({ error: expect.stringContaining("at least") });
    expect(mockedUpdateUser).not.toHaveBeenCalled();
  });

  it("rejects when the current password does not match", async () => {
    mockedCompare.mockResolvedValue(false as never);

    const result = await changePassword("wrong-password", NEW_PASSWORD);

    expect(result).toEqual({ error: "Current password is incorrect" });
    expect(mockedUpdateUser).not.toHaveBeenCalled();
  });

  it("refuses after too many attempts", async () => {
    mockedRateLimit.mockResolvedValue({ ok: false, remaining: 0, resetAt: 0 });

    const result = await changePassword(CURRENT_PASSWORD, NEW_PASSWORD);

    expect(result).toEqual({ error: "Too many attempts. Please try again later." });
    expect(mockedCompare).not.toHaveBeenCalled();
  });

  it("updates the password, logs it, and emails the owner on success", async () => {
    const result = await changePassword(CURRENT_PASSWORD, NEW_PASSWORD);

    expect(result).toEqual({ success: true });
    expect(mockedUpdateUser).toHaveBeenCalledWith({
      where: { id: "staff-1" },
      data: expect.objectContaining({ password: "hashed-password" }),
    });
    expect(mockedCreateAuditLog).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorId: "staff-1", action: "account.change-password" }),
    });
    expect(mockedSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ template: "account.password-changed", to: "staff@example.com" })
    );
  });

  it("evicts other live sessions by stamping passwordChangedAt", async () => {
    await changePassword(CURRENT_PASSWORD, NEW_PASSWORD);

    expect(mockedUpdateUser).toHaveBeenCalledWith({
      where: { id: "staff-1" },
      data: expect.objectContaining({ passwordChangedAt: expect.any(Date) }),
    });
  });

  it("collapses an unexpected failure to a generic error instead of throwing", async () => {
    mockedUpdateUser.mockRejectedValue(new Error("connection reset"));

    await expect(changePassword(CURRENT_PASSWORD, NEW_PASSWORD)).resolves.toEqual({
      error: "Failed to change password",
    });
  });
});

function formDataWith(file: File | null) {
  const formData = new FormData();
  if (file) formData.append("file", file);
  return formData;
}

const FAKE_FILE = new File(["fake-bytes"], "avatar.jpg", { type: "image/jpeg" });

describe("updateAvatar", () => {
  beforeEach(() => {
    mockedValidateUpload.mockResolvedValue({
      buffer: Buffer.from("fake-bytes"),
      contentType: "image/jpeg",
      size: 10,
    });
    mockedUploadToCloudinary.mockResolvedValue(
      "https://res.cloudinary.com/demo/image/upload/profile_pics/staff-1.jpg"
    );
  });

  it("rejects when no file is provided", async () => {
    const result = await updateAvatar(formDataWith(null));

    expect(result).toEqual({ error: "No file provided" });
    expect(mockedUpdateUser).not.toHaveBeenCalled();
  });

  it("surfaces the validator's message for a rejected file", async () => {
    mockedValidateUpload.mockRejectedValue(new Error("Unsupported file type."));

    const result = await updateAvatar(formDataWith(FAKE_FILE));

    expect(result).toEqual({ error: "Unsupported file type." });
    expect(mockedUploadToCloudinary).not.toHaveBeenCalled();
    expect(mockedUpdateUser).not.toHaveBeenCalled();
  });

  it("uploads to Cloudinary and stores the URL on the account", async () => {
    const result = await updateAvatar(formDataWith(FAKE_FILE));

    expect(result).toEqual({
      url: "https://res.cloudinary.com/demo/image/upload/profile_pics/staff-1.jpg",
    });
    expect(mockedUploadToCloudinary).toHaveBeenCalledWith(expect.any(Buffer), "profile_pics");
    expect(mockedUpdateUser).toHaveBeenCalledWith({
      where: { id: "staff-1" },
      data: { image: "https://res.cloudinary.com/demo/image/upload/profile_pics/staff-1.jpg" },
    });
  });

  it("does not authorize a caller who isn't signed in as staff", async () => {
    mockedRequireStaff.mockRejectedValue(new Error("Unauthorized"));

    await expect(updateAvatar(formDataWith(FAKE_FILE))).rejects.toThrow("Unauthorized");
    expect(mockedUploadToCloudinary).not.toHaveBeenCalled();
  });
});
