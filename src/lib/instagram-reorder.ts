/**
 * Swap `id`'s position with its neighbour in `direction`. Pure, so the admin
 * reorder buttons (instagram-actions.ts) can be unit tested without a
 * database — see the frontend/gallery precedent: this repo tests logic, not
 * Prisma calls.
 */
export function reorderFeatured(
  ids: string[],
  id: string,
  direction: "up" | "down"
): string[] {
  const index = ids.indexOf(id);
  if (index === -1) return ids;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return ids;

  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
