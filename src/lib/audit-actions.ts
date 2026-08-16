"use server";

import { prisma } from "./prisma";
import { requirePermission } from "./guards";
import { isPermission } from "./permissions";
import { AUDIT_PAGE_SIZE } from "./audit-constants";

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
  if (filter.from || filter.to) {
    where.createdAt = {
      ...(filter.from ? { gte: new Date(filter.from) } : {}),
      ...(filter.to ? { lte: new Date(filter.to) } : {}),
    };
  }

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
