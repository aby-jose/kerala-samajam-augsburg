import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ publicAuthOptions: {} }));
vi.mock("@/lib/cloudinary", () => ({ uploadToCloudinary: vi.fn() }));
vi.mock("@google/generative-ai", () => ({ GoogleGenerativeAI: vi.fn() }));
vi.mock("@/lib/guards", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/feature-gate", () => ({ assertFeature: vi.fn() }));
vi.mock("@/lib/rbac/audit", () => ({ describeAudit: vi.fn() }));
vi.mock("@/lib/captcha", () => ({ generateCaptcha: vi.fn(), verifyCaptcha: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/ticket", () => ({ generateTicketId: vi.fn() }));
vi.mock("@/lib/membership-term", () => ({
  PAYMENT_METHODS: {},
  SUBSCRIPTION_STATUS: {},
  PENDING_STATUSES: [],
  isPaymentMethod: vi.fn(),
}));
vi.mock("@/lib/email", () => ({ sendMail: vi.fn(), sendMailBatch: vi.fn(), templates: {} }));
vi.mock("@/lib/admin-contact", () => ({ adminEmailOrNull: vi.fn() }));
vi.mock("@/lib/revenue", () => ({ getCollectedRevenue: vi.fn() }));
vi.mock("@/lib/format-stats", () => ({ percentChange: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guards";
import {
  upsertEvent,
  getEventBySlug,
  getAdminEvents,
  getUpcomingEvents,
} from "@/lib/event-actions";

const mockedRequirePermission = vi.mocked(requirePermission);
const mockedCreate = vi.mocked(prisma.event.create);
const mockedUpdate = vi.mocked(prisma.event.update);
const mockedFindUnique = vi.mocked(prisma.event.findUnique);
const mockedFindMany = vi.mocked(prisma.event.findMany);

const BASE_INPUT = {
  title: "Onam Celebration 2026",
  slug: "onam-celebration-2026",
  description: "A community celebration.",
  date: "2026-09-15",
  location: "Community Hall",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequirePermission.mockResolvedValue(undefined as never);
});

describe("upsertEvent — sponsors", () => {
  it("creates an event with an empty sponsor list when none are provided", async () => {
    mockedFindUnique.mockResolvedValue(null as never);
    mockedCreate.mockResolvedValue({
      id: "event-1",
      date: new Date("2026-09-15"),
      location: "Community Hall",
      status: "SCHEDULED",
    } as never);

    await upsertEvent(BASE_INPUT as any);

    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sponsors: { create: [] } }),
      })
    );
  });

  it("creates an event with a nested, ordered sponsor list", async () => {
    mockedFindUnique.mockResolvedValue(null as never);
    mockedCreate.mockResolvedValue({
      id: "event-1",
      date: new Date("2026-09-15"),
      location: "Community Hall",
      status: "SCHEDULED",
    } as never);

    await upsertEvent({
      ...BASE_INPUT,
      sponsors: [
        { name: "Malabar Bank", logoUrl: "https://res.cloudinary.com/demo/image/upload/b.png", websiteUrl: "" },
        {
          name: "Kerala Spice Co.",
          logoUrl: "https://res.cloudinary.com/demo/image/upload/a.png",
          websiteUrl: "https://keralaspice.example",
        },
      ],
    } as any);

    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sponsors: {
            create: [
              { name: "Malabar Bank", logoUrl: "https://res.cloudinary.com/demo/image/upload/b.png", websiteUrl: "", order: 0 },
              {
                name: "Kerala Spice Co.",
                logoUrl: "https://res.cloudinary.com/demo/image/upload/a.png",
                websiteUrl: "https://keralaspice.example",
                order: 1,
              },
            ],
          },
        }),
      })
    );
  });

  it("defaults a sponsor's websiteUrl to an empty string when the key is omitted entirely", async () => {
    mockedFindUnique.mockResolvedValue(null as never);
    mockedCreate.mockResolvedValue({
      id: "event-1",
      date: new Date("2026-09-15"),
      location: "Community Hall",
      status: "SCHEDULED",
    } as never);

    await upsertEvent({
      ...BASE_INPUT,
      sponsors: [
        { name: "Malabar Bank", logoUrl: "https://res.cloudinary.com/demo/image/upload/b.png" },
      ],
    } as any);

    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sponsors: {
            create: [
              { name: "Malabar Bank", logoUrl: "https://res.cloudinary.com/demo/image/upload/b.png", websiteUrl: "", order: 0 },
            ],
          },
        }),
      })
    );
  });

  it("replaces the sponsor list on update via deleteMany + create", async () => {
    const existing = {
      id: "event-1",
      date: new Date("2026-09-15"),
      location: "Community Hall",
      status: "SCHEDULED",
    };
    mockedFindUnique.mockResolvedValue(existing as never);
    mockedUpdate.mockResolvedValue(existing as never);

    await upsertEvent({
      ...BASE_INPUT,
      id: "event-1",
      sponsors: [
        {
          name: "Kerala Spice Co.",
          logoUrl: "https://res.cloudinary.com/demo/image/upload/a.png",
          websiteUrl: "",
        },
      ],
    } as any);

    expect(mockedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "event-1" },
        data: expect.objectContaining({
          sponsors: {
            deleteMany: {},
            create: [
              { name: "Kerala Spice Co.", logoUrl: "https://res.cloudinary.com/demo/image/upload/a.png", websiteUrl: "", order: 0 },
            ],
          },
        }),
      })
    );
  });
});

describe("read paths — include sponsors", () => {
  it("getEventBySlug orders sponsors ascending", async () => {
    mockedFindUnique.mockResolvedValue({ id: "event-1" } as never);

    await getEventBySlug("onam-celebration-2026");

    expect(mockedFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          sponsors: { orderBy: { order: "asc" } },
        }),
      })
    );
  });

  it("getAdminEvents orders sponsors ascending", async () => {
    mockedFindMany.mockResolvedValue([] as never);

    await getAdminEvents();

    expect(mockedFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          sponsors: { orderBy: { order: "asc" } },
        }),
      })
    );
  });

  it("getUpcomingEvents includes just enough sponsor data for listing cards", async () => {
    mockedFindMany.mockResolvedValue([] as never);

    await getUpcomingEvents();

    expect(mockedFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          sponsors: {
            orderBy: { order: "asc" },
            select: { id: true, name: true, logoUrl: true },
          },
        },
      })
    );
  });
});
