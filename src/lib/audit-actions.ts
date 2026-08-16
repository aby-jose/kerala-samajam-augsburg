"use server";

import { prisma } from "./prisma";
import { requirePermission } from "./guards";
import { isPermission } from "./permissions";
import { AUDIT_PAGE_SIZE } from "./audit-constants";
import { parseAuditDateRange } from "./audit-filter";

/**
 * The audit log, as read by the committee.
 *
 * Entries are written by `requirePermission` (see guards.ts) for every
 * mutating permission — this file only ever reads them back.
 */

export interface AuditEntry {
  id: string;
  actorEmail: string;
  action: string;
  summary: string;
  entity: string | null;
  entityId: string | null;
  createdAt: Date;
}

export interface AuditLogPage {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getAuditLog(
  filter: {
    actorEmail?: string;
    action?: string;
    entity?: string;
    from?: string;
    to?: string;
    page?: number;
  } = {}
): Promise<AuditLogPage> {
  await requirePermission("audit.view");

  const page = Math.max(1, filter.page ?? 1);

  const where: Record<string, unknown> = {};
  if (filter.actorEmail) {
    where.actorEmail = { contains: filter.actorEmail.trim(), mode: "insensitive" };
  }
  // Only catalogued keys are accepted, so the filter cannot be used to probe
  // for arbitrary strings in the log.
  if (filter.action && isPermission(filter.action)) where.action = filter.action;
  if (filter.entity) where.entity = filter.entity;
  // Unparseable or inverted bounds are dropped rather than sent to Prisma —
  // see audit-filter.ts for why this can't just be `new Date(filter.from)`.
  const dateRange = parseAuditDateRange(filter.from, filter.to);
  if (dateRange) where.createdAt = dateRange;

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      select: {
        id: true,
        actorEmail: true,
        action: true,
        summary: true,
        entity: true,
        entityId: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { entries, total, page, pageSize: AUDIT_PAGE_SIZE };
}
