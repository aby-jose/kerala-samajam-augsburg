import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks -------------------------------------------------------------
//
// `event-actions.ts` has a wide import surface (Gemini, Cloudinary, email,
// rate limiting, ...). Only `registerForEvent`'s pricing decision is under
// test here, so every first-level (and the one dynamic) import is stubbed.

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  // The module-level `unstable_cache(fn, keys, opts)` call just needs to
  // hand back something callable; the 30s memoisation itself isn't under
  // test here.
  unstable_cache: (fn: unknown) => fn,
}));
vi.mock("@/lib/cloudinary", () => ({
  deleteFromCloudinary: vi.fn(),
  uploadToCloudinary: vi.fn(),
}));
vi.mock("@/lib/schemas", () => ({ eventSchema: { parse: vi.fn() } }));
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({ getGenerativeModel: vi.fn() })),
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ publicAuthOptions: {} }));
vi.mock("@/lib/guards", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/feature-gate", () => ({ assertFeature: vi.fn() }));
vi.mock("@/lib/rbac/audit", () => ({ describeAudit: vi.fn() }));
vi.mock("@/lib/captcha", () => ({
  generateCaptcha: vi.fn(),
  verifyCaptcha: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/ticket", () => ({ generateTicketId: vi.fn().mockReturnValue("TICKET-1") }));
vi.mock("@/lib/membership-term", () => ({
  PAYMENT_METHODS: { BANK_TRANSFER: "BANK_TRANSFER", CASH: "CASH" },
  SUBSCRIPTION_STATUS: {
    PENDING_VERIFICATION: "PENDING_VERIFICATION",
    AWAITING_PAYMENT: "AWAITING_PAYMENT",
    ACTIVE: "ACTIVE",
    REJECTED: "REJECTED",
    EXPIRED: "EXPIRED",
    CANCELLED: "CANCELLED",
  },
  PENDING_STATUSES: ["PENDING_VERIFICATION", "AWAITING_PAYMENT"],
  isPaymentMethod: (v: unknown) => v === "BANK_TRANSFER" || v === "CASH",
}));
vi.mock("@/lib/email", () => ({
  sendMail: vi.fn(),
  sendMailBatch: vi.fn(),
  templates: { events: { eventFull: vi.fn() } },
}));
vi.mock("@/lib/rbac/staff-queries", () => ({ superAdminEmails: vi.fn() }));
vi.mock("@/lib/revenue", () => ({ getCollectedRevenue: vi.fn() }));
vi.mock("@/lib/format-stats", () => ({ percentChange: vi.fn() }));
// Dynamically imported inside `registerForEvent` to auto-send the ticket;
// failures there are caught and logged, never surfaced, so a bare stub is
// enough.
vi.mock("@/lib/ticket-actions", () => ({ sendEventTicket: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    subscription: { findFirst: vi.fn() },
    registration: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { assertFeature } from "@/lib/feature-gate";
import { verifyCaptcha } from "@/lib/captcha";
import { registerForEvent } from "@/lib/event-actions";

const mockedFindEvent = vi.mocked(prisma.event.findUnique);
const mockedFindSubscription = vi.mocked(prisma.subscription.findFirst);
const mockedCreateRegistration = vi.mocked(prisma.registration.create);
const mockedGetServerSession = vi.mocked(getServerSession);
const mockedAssertFeature = vi.mocked(assertFeature);
const mockedVerifyCaptcha = vi.mocked(verifyCaptcha);

// The event is two months out; the member's term ends in three weeks —
// active right now, but not any more by the time the event happens.
const EVENT_DATE = new Date("2026-11-01T00:00:00.000Z");
const SUBSCRIPTION_END_DATE = new Date("2026-09-21T00:00:00.000Z");

const BASE_EVENT = {
  id: "event-1",
  status: "SCHEDULED",
  registrationsFull: false,
  maxAttendees: null,
  requiresLogin: false,
  memberPrice: 10,
  nonMemberPrice: 25,
  price: null,
  date: EVENT_DATE,
  _count: { registrations: 0 },
};

const REGISTRATION_INPUT = {
  eventId: "event-1",
  name: "Alice Member",
  email: "alice@example.org",
  phone: "+491234567",
  attendees: 1,
  captchaId: "captcha-1",
  captchaCode: "ABCD",
};

beforeEach(() => {
  vi.resetAllMocks();
  mockedAssertFeature.mockResolvedValue(undefined as never);
  mockedVerifyCaptcha.mockResolvedValue(true);
  mockedFindEvent.mockResolvedValue(BASE_EVENT as never);
  mockedCreateRegistration.mockResolvedValue({
    id: "reg-1",
    ticketId: "TICKET-1",
  } as never);
  mockedGetServerSession.mockResolvedValue({
    user: { id: "user-1", name: "Alice Member", email: "alice@example.org" },
  } as never);
});

/**
 * `prisma.subscription.findFirst({ where: { endDate: { gte: <cutoff> } } })`
 * only ever returns a row when `SUBSCRIPTION_END_DATE` is on or after
 * whatever cutoff the caller queried with — the same thing the real
 * `endDate: { gte }` filter does in Postgres. Simulating that filter (rather
 * than always resolving true/false) is what lets a single mock exercise
 * "was the right cutoff used", which is the whole point of these tests.
 */
function resolveSubscriptionAsOfCutoff(args: { where: { endDate: { gte: Date } } }) {
  const cutoff = args.where.endDate.gte;
  return Promise.resolve(
    SUBSCRIPTION_END_DATE.getTime() >= cutoff.getTime() ? { id: "sub-1" } : null
  );
}

describe("registerForEvent — the member rate requires the membership to still be running on the event date", () => {
  it("charges the non-member rate when the subscription expires before the event, even though it is active today", async () => {
    mockedFindSubscription.mockImplementation(resolveSubscriptionAsOfCutoff as never);

    const result = await registerForEvent(REGISTRATION_INPUT);

    expect(result.amountDue).toBe(25); // nonMemberPrice, not memberPrice
    expect(mockedCreateRegistration).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pricePaid: 25 }) })
    );
  });

  it("still charges the member rate when the subscription outlasts the event", async () => {
    mockedFindSubscription.mockImplementation(resolveSubscriptionAsOfCutoff as never);
    // Same membership as the test above, but this event lands before the
    // term ends.
    mockedFindEvent.mockResolvedValue({
      ...BASE_EVENT,
      date: new Date("2026-09-10T00:00:00.000Z"),
    } as never);

    const result = await registerForEvent(REGISTRATION_INPUT);

    expect(result.amountDue).toBe(10); // memberPrice
  });

  it("passes the event's date, not today, as the subscription cutoff", async () => {
    mockedFindSubscription.mockResolvedValue(null);

    await registerForEvent(REGISTRATION_INPUT);

    expect(mockedFindSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ endDate: { gte: EVENT_DATE } }),
      })
    );
  });
});
