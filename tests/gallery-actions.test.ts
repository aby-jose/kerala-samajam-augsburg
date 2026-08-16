import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks -------------------------------------------------------------
//
// Everything `gallery-actions.ts` imports is stubbed except `feature-gate`
// itself, which is the point of the exercise: the gate runs for real, reading
// a mocked config, so this proves the action is actually wired to it rather
// than that the helper works in isolation.

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ publicAuthOptions: {} }));
vi.mock("@/lib/cloudinary", () => ({ default: {}, uploadToCloudinary: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/guards", () => ({
  can: vi.fn(),
  getAdminUser: vi.fn(),
  requireAnyUser: vi.fn(),
  requirePermission: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock("@/lib/rbac/upload-folder", () => ({ resolveUploadFolder: vi.fn() }));
vi.mock("@/lib/upload-validation", () => ({ validateUpload: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendMail: vi.fn(), templates: {} }));
vi.mock("@/lib/config-utils", () => ({ getConfig: vi.fn() }));
vi.mock("@/lib/admin-contact", () => ({ adminEmail: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  NOT_REVOKED: {},
  prisma: {
    galleryAlbum: { findUnique: vi.fn() },
    mediaContribution: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/config-utils";
import { featureDisabledMessage } from "@/lib/feature-gate";
import { submitMediaContribution } from "@/lib/gallery-actions";

const mockedGetConfig = vi.mocked(getConfig);
const mockedGetServerSession = vi.mocked(getServerSession);
const mockedFindAlbum = vi.mocked(prisma.galleryAlbum.findUnique);
const mockedCreateContribution = vi.mocked(prisma.mediaContribution.create);

const CONTRIBUTION = {
  albumId: "album-1",
  url: "https://example.org/a.jpg",
  publicId: "a",
  type: "IMAGE" as const,
};

function configWithGallery(enableGallery: boolean) {
  return {
    features: {
      enableRegistration: true,
      enableGallery,
      enableMembership: true,
      maintenanceMode: false,
    },
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetServerSession.mockResolvedValue({
    user: { id: "member-1", name: "Asha" },
  } as never);
  mockedFindAlbum.mockResolvedValue({ id: "album-1", title: "Onam" } as never);
  mockedCreateContribution.mockResolvedValue({ id: "contrib-1" } as never);
});

describe("submitMediaContribution — respects the gallery switch", () => {
  it("accepts a contribution while the gallery is on", async () => {
    mockedGetConfig.mockResolvedValue(configWithGallery(true));

    const result = await submitMediaContribution(CONTRIBUTION, true);

    expect(result.success).toBe(true);
    expect(mockedCreateContribution).toHaveBeenCalled();
  });

  it("refuses when the gallery is switched off", async () => {
    mockedGetConfig.mockResolvedValue(configWithGallery(false));

    await expect(submitMediaContribution(CONTRIBUTION, true)).rejects.toThrow(
      featureDisabledMessage("enableGallery")
    );
  });

  /**
   * The switch has to bite on the server, not just in the UI. Hiding the
   * upload button leaves this action reachable by anyone who kept the tab open
   * or hand-writes the request, and a contribution written while the module is
   * off would sit in the moderation queue for a gallery that is not running.
   */
  it("writes nothing when the gallery is off, even for a signed-in member", async () => {
    mockedGetConfig.mockResolvedValue(configWithGallery(false));

    await expect(submitMediaContribution(CONTRIBUTION, true)).rejects.toThrow();

    expect(mockedCreateContribution).not.toHaveBeenCalled();
    expect(mockedFindAlbum).not.toHaveBeenCalled();
  });
});
