import { cache } from "react";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requestFingerprint } from "@/lib/consent-recorder";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import type { StaffContext } from "@/lib/guards";

/**
 * The audit row created during this request, if any.
 *
 * `cache()` is per-request, so this is a request-scoped slot rather than a
 * module global — two concurrent requests do not see each other's entry.
 */
const auditSlot = cache(() => ({ id: null as string | null }));

/** The default summary when an action does not supply a better one. */
export function auditSummaryFor(action: Permission): string {
  return PERMISSIONS[action].label;
}

/**
 * What may legally be stored in an audit entry's `metadata`.
 *
 * Deliberately narrower than `Record<string, unknown>`: a Date, a class
 * instance or a circular object reaches Prisma as an unserialisable value,
 * fails the write, and — because the write is wrapped to never throw — loses
 * the detail silently. The type is the only thing that can catch that, so it
 * has to be able to.
 */
type JsonSafe = string | number | boolean | null | JsonSafe[] | { [key: string]: JsonSafe };

/**
 * Writes the baseline entry.
 *
 * Called by `requirePermission` for any permission whose `mutates` flag is
 * set, which is what guarantees the floor: an action cannot go unlogged
 * because its author forgot to log it. Actions that know more call
 * `describeAudit` afterwards to enrich this row.
 *
 * Never throws. A failure to write history must not roll back the act itself.
 */
export async function recordAudit(ctx: StaffContext, action: Permission): Promise<void> {
  try {
    const { ipHash } = await requestFingerprint();
    const row = await prisma.auditLog.create({
      data: {
        actorId: ctx.id,
        actorEmail: ctx.email,
        action,
        summary: auditSummaryFor(action),
        ipHash,
      },
      select: { id: true },
    });
    auditSlot().id = row.id;
  } catch (error) {
    console.error("Failed to write audit entry", { action, actor: ctx.email, error });
  }
}

/**
 * Adds detail to the entry created earlier in this request.
 *
 * A no-op when nothing was recorded — a read-only permission, or a caller that
 * reached here without a guard.
 */
export async function describeAudit(detail: {
  summary?: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, JsonSafe>;
}): Promise<void> {
  try {
    const id = auditSlot().id;
    if (!id) return;
    await prisma.auditLog.update({
      where: { id },
      data: {
        ...detail,
        // Sound now that the input is JsonSafe rather than unknown: Prisma
        // models a JSON null as `JsonNull`, not `null`, which is the one gap
        // between this type and Prisma's own `InputJsonValue`.
        metadata: detail.metadata as unknown as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    console.error("Failed to enrich audit entry", { error });
  }
}
