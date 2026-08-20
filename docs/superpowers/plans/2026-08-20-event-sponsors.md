# Event Sponsors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin attach sponsors (name, logo, optional website link) to an event, and show them on the event's public page and as a badge on the event card.

**Architecture:** A new `EventSponsor` Prisma model, owned one-to-many by `Event` (mirroring the existing `GalleryAlbum`→`GalleryMedia` shape), fully replaced on every event save via Prisma nested writes. Logo upload reuses the existing `ImageUpload` component and `uploadImageAction`/Cloudinary pipeline — no new upload path. Reordering happens client-side in the admin form (`useFieldArray.swap`), submitted as array order — no separate reorder server action.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript, Prisma 6 (MongoDB, `prisma db push` — no migration files), `react-hook-form` + `zod` v4, Cloudinary, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-event-sponsors-design.md`

## Global Constraints

- No new npm dependencies — everything needed (`react-hook-form`, `zod`, `cloudinary`, `lucide-react`) is already in `package.json`.
- MongoDB via Prisma — schema changes apply via `npx prisma db push` (no `prisma/migrations` directory exists in this project; do not create one).
- Sponsors are per-event only — no shared/global sponsor table (spec §3, §4 D2).
- Logo upload must go through the same component/action as every other image upload in the admin (spec §4 D4) — no bespoke upload code.
- No new server action or permission — sponsor writes ride inside `upsertEvent`'s existing `requirePermission("events.edit")` gate (spec §4 D10). Do not add an entry to `tests/action-coverage.test.ts`'s `UNGUARDED_ACTIONS`/allowlists — none is needed since no new exported action is created.

---

### Task 1: Prisma schema — `EventSponsor` model

**Files:**
- Modify: `prisma/schema.prisma` (`Event` model at lines 111–161)

**Interfaces:**
- Produces: `EventSponsor` model (`id`, `name`, `logoUrl`, `websiteUrl`, `order`, `eventId`, `event`, `createdAt`, `updatedAt`) and `Event.sponsors: EventSponsor[]` — consumed by Task 3 (Prisma calls in `event-actions.ts`) and, via the generated Prisma Client types, by Tasks 5 and 6 (`EventDetail`/`UpcomingEvent` type inference).

- [ ] **Step 1: Add the `sponsors` relation field to `Event`**

In `prisma/schema.prisma`, in the `Event` model, add the new relation field right after the existing `galleryAlbum` field (line 152):

```prisma
  galleryAlbum   GalleryAlbum[]
  sponsors       EventSponsor[]
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
```

- [ ] **Step 2: Add the `EventSponsor` model**

Immediately after the `EventStatus` enum closes (after line 161), insert:

```prisma
model EventSponsor {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  name       String
  logoUrl    String
  websiteUrl String   @default("")
  order      Int      @default(0)
  eventId    String   @db.ObjectId
  event      Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

`onDelete: Cascade` follows the `GalleryMedia.album` precedent (schema.prisma line 223) — sponsors are true owned children of an event, unlike `Registration`/`GalleryAlbum` which deliberately don't cascade.

- [ ] **Step 3: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Push the schema and regenerate the client**

Run: `npx prisma db push`
Expected: output ending with `Your database is now in sync with your schema.` and `✔ Generated Prisma Client`.

(If `npx prisma db push` cannot reach the database in this environment, run `npx prisma generate` on its own so `@prisma/client`'s TypeScript types include `EventSponsor` for the remaining tasks, and push the schema separately before Task 3 is exercised against a real database.)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add EventSponsor model"
```

---

### Task 2: Zod schema — `eventSponsorSchema`

**Files:**
- Modify: `src/lib/schemas.ts` (`eventSchema` at lines 30–53)
- Test: `tests/event-sponsors-schema.test.ts`

**Interfaces:**
- Consumes: nothing new (pure zod, no Prisma dependency).
- Produces: `eventSponsorSchema` (zod object: `name: string, min 1`; `logoUrl: string, min 1`; `websiteUrl: optional url or ""`), `EventSponsorFormValue` type, and `eventSchema.sponsors: EventSponsorFormValue[]` (defaults to `[]`) — consumed by Task 3 (`upsertEvent` destructures/validates `sponsors`) and Task 4 (admin form's field array is typed by `EventSponsorFormValue`, validated via the same `zodResolver(eventSchema)` already wired up).

- [ ] **Step 1: Write the failing test**

Create `tests/event-sponsors-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { eventSponsorSchema, eventSchema } from "@/lib/schemas";

describe("eventSponsorSchema", () => {
  it("accepts a sponsor with name, logo, and website", () => {
    const result = eventSponsorSchema.safeParse({
      name: "Kerala Spice Co.",
      logoUrl: "https://res.cloudinary.com/demo/image/upload/logo.png",
      websiteUrl: "https://example.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a sponsor with no website", () => {
    const result = eventSponsorSchema.safeParse({
      name: "Kerala Spice Co.",
      logoUrl: "https://res.cloudinary.com/demo/image/upload/logo.png",
      websiteUrl: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a sponsor with no name", () => {
    const result = eventSponsorSchema.safeParse({
      name: "",
      logoUrl: "https://res.cloudinary.com/demo/image/upload/logo.png",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a sponsor with no logo", () => {
    const result = eventSponsorSchema.safeParse({
      name: "Kerala Spice Co.",
      logoUrl: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed website URL", () => {
    const result = eventSponsorSchema.safeParse({
      name: "Kerala Spice Co.",
      logoUrl: "https://res.cloudinary.com/demo/image/upload/logo.png",
      websiteUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

describe("eventSchema sponsors field", () => {
  const baseEvent = {
    title: "Onam Celebration 2026",
    slug: "onam-celebration-2026",
    description: "A community celebration.",
    date: "2026-09-15",
    location: "Community Hall",
  };

  it("defaults to an empty sponsor list when omitted", () => {
    const result = eventSchema.parse(baseEvent);
    expect(result.sponsors).toEqual([]);
  });

  it("accepts a populated sponsor list", () => {
    const result = eventSchema.parse({
      ...baseEvent,
      sponsors: [
        {
          name: "Kerala Spice Co.",
          logoUrl: "https://res.cloudinary.com/demo/image/upload/logo.png",
          websiteUrl: "",
        },
      ],
    });
    expect(result.sponsors).toHaveLength(1);
  });

  it("rejects an event whose sponsor list has an invalid entry", () => {
    const result = eventSchema.safeParse({
      ...baseEvent,
      sponsors: [{ name: "", logoUrl: "" }],
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/event-sponsors-schema.test.ts`
Expected: FAIL — `eventSponsorSchema` is not exported from `@/lib/schemas`.

- [ ] **Step 3: Implement `eventSponsorSchema` and add it to `eventSchema`**

In `src/lib/schemas.ts`, add the new schema immediately before `export const eventSchema = z.object({` (line 30):

```ts
export const eventSponsorSchema = z.object({
  name: z.string().min(1, "Sponsor name is required"),
  logoUrl: z.string().min(1, "Logo is required"),
  websiteUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

export type EventSponsorFormValue = z.infer<typeof eventSponsorSchema>;
```

Then add the `sponsors` field as the last field inside `eventSchema`, right after `maxAttendees` (line 50):

```ts
  maxAttendees: z.number().int("Capacity must be a whole number").positive("Capacity must be positive").optional().nullable(),
  sponsors: z.array(eventSponsorSchema).default([]),
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/event-sponsors-schema.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts tests/event-sponsors-schema.test.ts
git commit -m "feat: add eventSponsorSchema and sponsors field to eventSchema"
```

---

### Task 3: Server actions — sync sponsors in `upsertEvent`, include them on read

**Files:**
- Modify: `src/lib/event-actions.ts` (`upsertEvent` lines 102–177, `getAdminEvents` lines 63–74, `getEventBySlug` lines 91–100, `getUpcomingEvents` lines 81–89)
- Test: `tests/event-sponsors-actions.test.ts`

**Interfaces:**
- Consumes: `eventSchema`/`EventFormValues`/`EventSponsorFormValue` (Task 2), `EventSponsor` Prisma model (Task 1).
- Produces: `upsertEvent` writes `sponsors: { create: [...] }` (new event) / `sponsors: { deleteMany: {}, create: [...] }` (existing event), each entry `{ name, logoUrl, websiteUrl, order }` in submitted order. `getEventBySlug` and `getAdminEvents` return `sponsors: EventSponsor[]` ordered by `order` ascending. `getUpcomingEvents` returns `sponsors: { id: string }[]` (id-only, for a card count/boolean, not full rows). Consumed by Task 4 (admin form prefill via `getAdminEvents`), Task 5 (`EventDetail.sponsors`), Task 6 (`UpcomingEvent.sponsors`).

- [ ] **Step 1: Write the failing tests**

Create `tests/event-sponsors-actions.test.ts`:

```ts
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

  it("getUpcomingEvents includes sponsor ids only", async () => {
    mockedFindMany.mockResolvedValue([] as never);

    await getUpcomingEvents();

    expect(mockedFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { sponsors: { select: { id: true } } },
      })
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/event-sponsors-actions.test.ts`
Expected: FAIL — actual `data`/`include` shapes don't yet contain `sponsors`.

- [ ] **Step 3: Update `upsertEvent`**

In `src/lib/event-actions.ts`, replace lines 105–147 with:

```ts
  const validated = eventSchema.parse(data);
  const { id, sponsors, ...eventData } = validated;

  let finalImageUrl = eventData.imageUrl;

  // AI-generated covers arrive as a data URL — `generateEventImage` fetches the
  // image and returns it inline — so they still need uploading here. Files
  // chosen in the form no longer take this path: the modal uploads them via
  // `uploadImageAction` and submits a URL, which also gets them size and
  // type validation this branch has never had.
  if (eventData.imageUrl && eventData.imageUrl.startsWith("data:image")) {
    try {
      finalImageUrl = await uploadToCloudinary(eventData.imageUrl);
    } catch (error) {
      console.error("Cloudinary upload failed in server action:", error);
      // Fallback or handle error
    }
  }

  const prismaData = {
    ...eventData,
    imageUrl: finalImageUrl,
    date: new Date(validated.date),
    maxAttendees: validated.maxAttendees || null,
    // Sponsors are a small, admin-edited list fully replaced on every save
    // (design doc §7) — simplest correct sync, using the row order already
    // submitted from the form rather than trusting a client-supplied `order`.
    sponsors: {
      ...(id ? { deleteMany: {} } : {}),
      create: sponsors.map((sponsor, index) => ({
        name: sponsor.name,
        logoUrl: sponsor.logoUrl,
        websiteUrl: sponsor.websiteUrl ?? "",
        order: index,
      })),
    },
  };

  // The state before the edit, so a moved date or venue can be recognised as
  // such. Someone who has already booked their Saturday around an event needs
  // telling when it moves; nobody needs telling that the description was
  // reworded, so only these two fields are compared.
  const before = id ? await prisma.event.findUnique({ where: { id } }) : null;

  let event: Event;
  if (id) {
    event = await prisma.event.update({
      where: { id },
      data: prismaData,
    });
  } else {
    event = await prisma.event.create({
      data: prismaData,
    });
  }
```

(The rest of `upsertEvent`, from the `notified` notification block onward, is unchanged.)

- [ ] **Step 4: Include sponsors in `getEventBySlug`**

In `src/lib/event-actions.ts` (lines 91–100), change:

```ts
export async function getEventBySlug(slug: string) {
  return await prisma.event.findUnique({
    where: { slug },
    include: {
      _count: {
        select: { registrations: true }
      },
      sponsors: {
        orderBy: { order: "asc" },
      },
    }
  });
}
```

- [ ] **Step 5: Include sponsors in `getAdminEvents`**

In `src/lib/event-actions.ts` (lines 63–74), change:

```ts
export async function getAdminEvents() {
  await requirePermission("events.view");

  return await prisma.event.findMany({
    include: {
      _count: {
        select: { registrations: true }
      },
      sponsors: {
        orderBy: { order: "asc" },
      },
    },
    orderBy: { date: 'desc' }
  });
}
```

- [ ] **Step 6: Include sponsor ids in `getUpcomingEvents`**

In `src/lib/event-actions.ts` (lines 81–89), change:

```ts
export async function getUpcomingEvents() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return await prisma.event.findMany({
    where: { isPublished: true, date: { gte: startOfToday } },
    orderBy: { date: 'asc' },
    include: {
      sponsors: {
        select: { id: true },
      },
    },
  });
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/event-sponsors-actions.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Run the full test suite to check for regressions**

Run: `npm run test`
Expected: PASS — no existing test broken by the `upsertEvent`/`getAdminEvents`/`getEventBySlug`/`getUpcomingEvents` changes.

- [ ] **Step 9: Commit**

```bash
git add src/lib/event-actions.ts tests/event-sponsors-actions.test.ts
git commit -m "feat: sync sponsors in upsertEvent and include them on read"
```

---

### Task 4: Admin form — Sponsors editor

**Files:**
- Modify: `src/components/admin/image-upload.tsx` (add `folder` prop)
- Modify: `src/components/admin/event-form-modal.tsx` (imports, `useForm`/`useFieldArray` setup, new "Sponsors" section)

**Interfaces:**
- Consumes: `EventSponsorFormValue`, `eventSchema` (Task 2); `getAdminEvents`'s `sponsors` (Task 3, via `initialData` passed into this modal) for edit-mode prefill.
- Produces: `ImageUpload`'s new optional `folder?: string` prop (backward compatible — existing callers that omit it keep today's behaviour). No new exports consumed elsewhere.

- [ ] **Step 1: Add a `folder` prop to `ImageUpload`**

In `src/components/admin/image-upload.tsx`, update the props interface (lines 9–15):

```ts
interface ImageUploadProps {
  onUploadComplete: (url: string, publicId: string) => void;
  defaultValue?: string;
  className?: string;
  aspect?: string;
  accept?: string;
  folder?: string;
}
```

Update the function signature (lines 17–23):

```ts
export default function ImageUpload({
    onUploadComplete,
    defaultValue,
    className,
    aspect = "aspect-video",
    accept = "image/*",
    folder,
}: ImageUploadProps) {
```

Update the upload call (line 65) to pass it through:

```ts
      const result = await uploadImageAction(formData, folder) as { url: string; publicId: string };
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/image-upload.tsx
git commit -m "feat: let ImageUpload target a custom Cloudinary folder"
```

- [ ] **Step 4: Add imports and wire up `useFieldArray` in `event-form-modal.tsx`**

In `src/components/admin/event-form-modal.tsx`, update the `lucide-react` import (lines 6–16) to add `Plus`, `MoveUp`, `MoveDown`:

```tsx
import {
  X,
  Loader2,
  Image as ImageIcon,
  Clock,
  Sparkles,
  Upload,
  Zap,
  Trash2,
  RefreshCw,
  Plus,
  MoveUp,
  MoveDown,
} from "lucide-react";
```

Update the `react-hook-form` import (line 4) to include `useFieldArray`:

```tsx
import { useForm, useFieldArray, SubmitHandler } from "react-hook-form";
```

Add an import for the reusable upload component, after the `uploadImageAction` import (line 23):

```tsx
import ImageUpload from "@/components/admin/image-upload";
```

- [ ] **Step 5: Add `control` to the `useForm` destructure and `sponsors` to `defaultValues`**

Change lines 50–78 from:

```tsx
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(eventSchema) as any,
    defaultValues: {
      title: "",
      slug: "",
      description: "",
      date: "",
      startTime: "",
      endTime: "",
      location: "",
      address: "",
      imageUrl: "",
      category: "",
      price: "",
      isFeatured: false,
      isPublished: false,
      requiresLogin: false,
      maxAttendees: null,
      memberPrice: null,
      nonMemberPrice: null,
    },
  });
```

to:

```tsx
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(eventSchema) as any,
    defaultValues: {
      title: "",
      slug: "",
      description: "",
      date: "",
      startTime: "",
      endTime: "",
      location: "",
      address: "",
      imageUrl: "",
      category: "",
      price: "",
      isFeatured: false,
      isPublished: false,
      requiresLogin: false,
      maxAttendees: null,
      memberPrice: null,
      nonMemberPrice: null,
      sponsors: [],
    },
  });

  const {
    fields: sponsorFields,
    append: appendSponsor,
    remove: removeSponsor,
    swap: swapSponsor,
  } = useFieldArray({ control, name: "sponsors" });
```

- [ ] **Step 6: Include `sponsors` in both `reset()` calls**

In the `useEffect` at lines 84–127, add `sponsors` to the edit-mode `reset()` (after `nonMemberPrice`, line 103):

```tsx
        nonMemberPrice: initialData.nonMemberPrice ?? null,
        sponsors: (initialData.sponsors || []).map((sponsor: any) => ({
          name: sponsor.name || "",
          logoUrl: sponsor.logoUrl || "",
          websiteUrl: sponsor.websiteUrl || "",
        })),
      });
```

and to the create-mode `reset()` (after `nonMemberPrice`, line 123):

```tsx
        nonMemberPrice: null,
        sponsors: [],
      });
```

- [ ] **Step 7: Add the Sponsors section to the form JSX**

In `src/components/admin/event-form-modal.tsx`, insert immediately after the "Image & Assets Section" closes (after line 716's `</div>`, before the divider on line 718):

```tsx
            {/* Sponsors Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Sponsors</Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => appendSponsor({ name: "", logoUrl: "", websiteUrl: "" })}
                  className="h-8 rounded-lg text-xs"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add sponsor
                </Button>
              </div>

              {sponsorFields.length === 0 ? (
                <p className="text-xs text-muted-foreground">No sponsors added yet.</p>
              ) : (
                <div className="space-y-3">
                  {sponsorFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-start gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="w-20 shrink-0">
                        <ImageUpload
                          aspect="aspect-square"
                          folder="kerala-samajam/sponsors"
                          defaultValue={watch(`sponsors.${index}.logoUrl`)}
                          onUploadComplete={(url) =>
                            setValue(`sponsors.${index}.logoUrl`, url, { shouldValidate: true })
                          }
                        />
                        {errors.sponsors?.[index]?.logoUrl && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {errors.sponsors[index]?.logoUrl?.message}
                          </p>
                        )}
                      </div>

                      <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Input
                            {...register(`sponsors.${index}.name`)}
                            placeholder="Sponsor name"
                            className="h-9 rounded-lg"
                          />
                          {errors.sponsors?.[index]?.name && (
                            <p className="text-xs text-red-600 dark:text-red-400">
                              {errors.sponsors[index]?.name?.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Input
                            {...register(`sponsors.${index}.websiteUrl`)}
                            placeholder="https://sponsor-website.com (optional)"
                            className="h-9 rounded-lg"
                          />
                          {errors.sponsors?.[index]?.websiteUrl && (
                            <p className="text-xs text-red-600 dark:text-red-400">
                              {errors.sponsors[index]?.websiteUrl?.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === 0}
                          onClick={() => swapSponsor(index, index - 1)}
                          className="h-7 w-7 rounded-md"
                          aria-label="Move up"
                        >
                          <MoveUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === sponsorFields.length - 1}
                          onClick={() => swapSponsor(index, index + 1)}
                          className="h-7 w-7 rounded-md"
                          aria-label="Move down"
                        >
                          <MoveDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSponsor(index)}
                          className="h-7 w-7 rounded-md hover:text-red-600"
                          aria-label="Remove sponsor"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 9: Manual verification**

Run: `npm run dev`, sign in as an admin, open Events → New Event.
1. Add two sponsor rows, upload a logo image for each (via the new "Sponsors" section — confirm the upload spinner and preview behave exactly like the event cover image upload), fill in a name for each, leave one website URL blank and fill the other.
2. Click "Move up"/"Move down" and confirm the rows swap.
3. Save the event. Reopen it for editing and confirm both sponsors, their logos, names, order, and the one website URL are still there.
4. Remove a sponsor row and save; confirm only the remaining sponsor persists after reopening.

- [ ] **Step 10: Commit**

```bash
git add src/components/admin/event-form-modal.tsx
git commit -m "feat: add Sponsors editor to the admin event form"
```

---

### Task 5: Public event page — Sponsors section

**Files:**
- Modify: `src/app/(public)/events/[slug]/event-detail-client.tsx` (insert after line 685)

**Interfaces:**
- Consumes: `EventDetail.sponsors: EventSponsor[]` (Task 3, automatically part of the type since `EventDetail = NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>`).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Insert the Sponsors section**

In `src/app/(public)/events/[slug]/event-detail-client.tsx`, insert a new section between the end of "2. Detail + registration" (`</section>` on line 685) and the start of "3. Closing band" (the comment on line 687):

```tsx
      {event.sponsors.length > 0 && (
        <section className="border-b border-border bg-background py-16 md:py-20">
          <Container className="max-w-7xl">
            <span className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <span className="h-px w-6 bg-border" />
              With thanks to
            </span>

            <h2 className="mt-4 font-sans text-2xl font-bold tracking-[-0.02em] text-foreground">
              Our <Accent>Sponsors</Accent>
            </h2>

            <div className="mt-10 flex flex-wrap items-center gap-x-12 gap-y-8">
              {event.sponsors.map((sponsor) => {
                const logo = (
                  <img
                    src={sponsor.logoUrl}
                    alt={sponsor.name}
                    className="h-12 w-auto object-contain grayscale transition-[filter] duration-300 hover:grayscale-0 sm:h-14"
                  />
                );

                return sponsor.websiteUrl ? (
                  <a
                    key={sponsor.id}
                    href={sponsor.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-80 transition-opacity duration-300 hover:opacity-100"
                  >
                    {logo}
                  </a>
                ) : (
                  <span key={sponsor.id}>{logo}</span>
                );
              })}
            </div>
          </Container>
        </section>
      )}

```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, publish an event with sponsors (via Task 4's admin form), visit `/events/<slug>`.
1. Confirm the "With thanks to / Our Sponsors" band appears after the "Where" facts and before the closing "Members first" band, in the order set in the admin form.
2. Confirm a sponsor with a website link opens it in a new tab on click; a sponsor without one is not clickable.
3. Visit an event with zero sponsors and confirm the band doesn't render at all.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(public)/events/[slug]/event-detail-client.tsx"
git commit -m "feat: show sponsors on the event detail page"
```

---

### Task 6: Event card — "Sponsored" badge

**Files:**
- Modify: `src/components/events/event-card.tsx`
- Modify: `src/app/(public)/events/events-client.tsx` (lines 145–155)

**Interfaces:**
- Consumes: `UpcomingEvent.sponsors: { id: string }[]` (Task 3).
- Produces: `EventCardProps.event.sponsored?: boolean` — consumed only by `event-card.tsx` itself.

- [ ] **Step 1: Add the badge to `EventCard`**

In `src/components/events/event-card.tsx`, add `Handshake` to the `lucide-react` import (line 3):

```tsx
import { MapPin, CalendarDays, ArrowRight, Handshake } from "lucide-react";
```

Add `sponsored?: boolean;` to the props interface (after `category?: string;`, line 16):

```tsx
interface EventCardProps {
  event: {
    id: string;
    slug: string;
    title: string;
    date: string;
    location: string;
    description: string;
    image: string;
    category?: string;
    sponsored?: boolean;
  };
}
```

Add the badge markup right after the category `<span>` closes (after line 58), so it sits in the free top-right corner opposite the category pill:

```tsx
          {event.sponsored && (
            <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md">
              <Handshake className="h-3 w-3" strokeWidth={2} />
              Sponsored
            </span>
          )}
```

- [ ] **Step 2: Pass `sponsored` from the events list**

In `src/app/(public)/events/events-client.tsx`, update the `EventCard` call (lines 145–155):

```tsx
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={{
                ...event,
                date: event.date.toISOString(),
                image: event.imageUrl || "/images/placeholder.svg",
                category: event.category ?? undefined,
                sponsored: (event.sponsors?.length ?? 0) > 0,
              }}
            />
          ))}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, visit `/events`.
1. Confirm an event with at least one sponsor shows the "Sponsored" badge (no logos) in the calendar grid card.
2. Confirm an event with no sponsors shows no badge.

- [ ] **Step 5: Commit**

```bash
git add src/components/events/event-card.tsx "src/app/(public)/events/events-client.tsx"
git commit -m "feat: show a Sponsored badge on event cards"
```

---

## Self-Review

**Spec coverage:**
- §4 D1 (`EventSponsor` model, mirroring `GalleryAlbum`/`GalleryMedia`) → Task 1.
- §4 D2 (per-event only) → Task 1 (no global `Sponsor` table), Task 2 (schema nested inside `eventSchema`, no separate top-level entity).
- §4 D3 (name/logoUrl/websiteUrl fields) → Task 1, Task 2.
- §4 D4 (logo upload reuses `ImageUpload`/`uploadImageAction`) → Task 4 Steps 1–3, 7.
- §4 D5 (up/down reordering) → Task 4 Step 5/7 (`useFieldArray.swap`), matching the boundary-disabling pattern from `reels-manager.tsx`.
- §4 D6 (edited inline in the event form modal) → Task 4.
- §4 D7 (`deleteMany` + `create` nested write sync) → Task 3.
- §4 D8 (detail page logo strip, linked when a URL exists) → Task 5.
- §4 D9 (card badge, text only, no logos) → Task 6.
- §4 D10 (no new permission) → Task 3 (reuses `requirePermission("events.edit")`); confirmed no `tests/action-coverage.test.ts` allowlist entry is needed since no new exported action was added.
- §9 error handling (required name/logo, optional well-formed URL, empty string = no link) → Task 2's schema + tests; Task 4's inline error rendering.
- §10 testing → Task 2 (schema tests), Task 3 (`upsertEvent`/read-path tests). UI tasks (4–6) have no automated test harness available in this repo for React components (confirmed: no `*.test.tsx` files exist), so they carry explicit manual verification steps instead, per this repo's own established convention (e.g. `InstagramReel`'s pure-logic-only testing approach).

**Placeholder scan:** No `TBD`/`TODO`/"add appropriate X" phrasing; every code step is complete, copy-pasteable code, not a description of code.

**Type consistency:** `EventSponsorFormValue` (Task 2) is the type used for every `sponsors.${index}.*` field path in Task 4 and matches the shape produced by `sponsors.map(...)` in Task 3. `sponsor.id`/`sponsor.name`/`sponsor.logoUrl`/`sponsor.websiteUrl` used in Task 5 match the Prisma `EventSponsor` model fields from Task 1. `EventCardProps.event.sponsored` (Task 6) is consistently a `boolean | undefined`, computed the same way (`sponsors.length > 0`) as Task 5's render guard.
