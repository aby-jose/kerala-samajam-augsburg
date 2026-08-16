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
 * An inverted range (`from` later than `to`) is handled differently, on
 * purpose — it is NOT dropped the way an unparseable string is, even though
 * the two look like the same kind of "bad input" at a glance:
 *
 *   - An unparseable string is *ambiguous*. There is no reading of
 *     "not-a-date" that means anything, so ignoring it and falling back to
 *     "no bound" is a fair default.
 *   - An inverted range is *unambiguous*. Both dates parsed fine; the person
 *     typed two valid dates in the wrong order. Dropping both bounds in that
 *     case would silently turn "narrow this to a window" into "show
 *     everything" — the dangerous direction specifically on this screen.
 *     Someone filtering the audit log from June to January, expecting a
 *     narrow slice, would instead see the entire unfiltered log, read it as
 *     scoped, and could conclude an action never happened when it is simply
 *     outside the window they thought they'd applied. An empty result is
 *     self-evidently a filter problem; a full log looks like a legitimate
 *     answer. So the literal bounds are passed through unchanged instead:
 *     Prisma combines `gte` and `lte` on the same field into one condition,
 *     and no `Date` can be simultaneously `>=` a later date and `<=` an
 *     earlier one — that's true for any totally ordered type, not a Prisma
 *     quirk — so the query matches nothing. Narrowing to zero rows, not
 *     widening to everything, the same direction an empty filter should fail
 *     in. (This codebase already relies on the same single-field
 *     `{ gte, lte }` combination — see `analytics-actions.ts` — so it isn't
 *     a new assumption about how Prisma/MongoDB handles it here.)
 *
 * Do not "simplify" this back into treating both cases alike; that would
 * reintroduce the silent-widening bug.
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
