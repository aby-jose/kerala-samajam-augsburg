/**
 * Filters the admin sidebar's nav groups down to what the caller's role can
 * see. A group whose items are all hidden disappears entirely, heading
 * included — this is cosmetic only, every admin page still enforces its own
 * access via `requirePermissionPage`/`requireStaff`.
 *
 * An item's `permission` is optional: omitting it (as the "My account" link
 * does — every staff member may change their own password, regardless of
 * role) means the item is always shown to any signed-in staff member. This
 * is the one exception to "every nav item names a real permission" — there
 * is deliberately no other way to opt an item out of the permission check.
 */
export function filterNavGroups<
  G extends { items: readonly { permission?: string }[] }
>(groups: readonly G[], allowedPermissions: readonly string[]): G[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permission || allowedPermissions.includes(item.permission)
      ),
    }))
    .filter((group) => group.items.length > 0);
}
