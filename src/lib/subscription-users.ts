import { prisma } from "./prisma";

/**
 * Subscription -> User is not a DB-enforced foreign key on MongoDB, so
 * `prisma.subscription.findMany({ include: { user: true } })` throws
 * "Inconsistent query result: Field user is required to return data, got
 * null instead" the moment one row's user was ever removed directly in the
 * database rather than through the app — and that one bad row takes the
 * *entire* query down, not just itself. Look users up in a separate batched
 * query instead, so an orphaned row degrades to a placeholder rather than
 * crashing every admin list and reminder cron that touches subscriptions.
 */
export type SubscriptionUser = {
  id: string;
  name: string | null;
  email: string | null;
  anonymizedAt: Date | null;
};

const missingUser = (userId: string): SubscriptionUser => ({
  id: userId,
  name: null,
  email: null,
  anonymizedAt: null,
});

export async function attachSubscriptionUsers<T extends { userId: string }>(
  subs: T[]
): Promise<(T & { user: SubscriptionUser })[]> {
  const userIds = [...new Set(subs.map((s) => s.userId))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, anonymizedAt: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  return subs.map((s) => ({ ...s, user: userById.get(s.userId) ?? missingUser(s.userId) }));
}
