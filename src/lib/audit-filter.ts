/**
 * Turns the audit log's `from`/`to` filter strings into a Prisma `createdAt`
 * range, or `undefined` when neither bound survives validation.
 *
 * `getAuditLog` (audit-actions.ts) is a server action — a public RPC reachable
 * by anyone holding `audit.view`, not only by the bundled `<input type="date">`
 * filter, which happens to only ever emit valid ISO strings. A malformed value
 * from any other caller must not reach Prisma: `new Date("not-a-date")` parses
 * to `Invalid Date`, and handing that to `prisma.auditLog.findMany` throws
 * `PrismaClientValidationError` synchronously, breaking the action's declared
 * `Promise<AuditLogPage>` contract. An unparseable bound is dropped instead —
 * the same standard already applied to the `action` filter via `isPermission`:
 * an unrecognised or malformed filter degrades to "no bound" rather than
 * erroring the whole query.
 *
 * Split out of audit-actions.ts (rather than kept as a local function there)
 * so this pure logic can be unit-tested directly, without a database — the
 * same reason AUDIT_PAGE_SIZE lives in audit-constants.ts instead: a
 * "use server" file may only export async functions.
 */
export function parseAuditDateRange(
  from?: string,
  to?: string
): { gte?: Date; lte?: Date } | undefined {
  const gte = parseDate(from);
  const lte = parseDate(to);

  if (!gte && !lte) return undefined;

  // An inverted range can never match a row. Treating it as "no bound" keeps
  // a fat-fingered swap from silently rendering an empty page — the same
  // "degrade, don't error" choice as an unparseable value gets.
  if (gte && lte && gte > lte) return undefined;

  return {
    ...(gte ? { gte } : {}),
    ...(lte ? { lte } : {}),
  };
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
