import { ALL_PERMISSIONS, isPermission, type Permission } from "@/lib/permissions";

export interface ResolvableRole {
  isSystem: boolean;
  permissions: string[];
}

/**
 * A role row's effective permission set.
 *
 * Two rules that are easy to get wrong:
 *
 * A system role holds the *live catalogue*, not whatever was stored when its
 * row was written. Storing the array would leave Super Admin silently missing
 * any permission added in a later release.
 *
 * Unrecognised stored keys are dropped rather than carried. A permission
 * removed from the catalogue stays in old role rows until someone edits them,
 * and a stale key must never satisfy a check by accident.
 */
export function resolvePermissions(role: ResolvableRole | null): Set<Permission> {
  if (!role) return new Set();
  if (role.isSystem) return new Set(ALL_PERMISSIONS);
  return new Set(role.permissions.filter(isPermission));
}
