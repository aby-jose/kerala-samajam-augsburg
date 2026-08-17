/**
 * The four ways an administrator could lock everyone out, refused.
 *
 * These are pure predicates so they can be tested without a database and
 * called from any action. Each throws a `LockoutError`, whose message is
 * written to be shown to the user unchanged.
 */

export class LockoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LockoutError";
  }
}

/** Rule 1: the system role's permissions are computed and must stay that way. */
export function assertRoleEditable(role: { isSystem: boolean }): void {
  if (role.isSystem) {
    throw new LockoutError(
      "Super Admin always holds every permission and cannot be edited."
    );
  }
}

/** Rules 1 and 4: the system role is permanent; a role in use must be emptied first. */
export function assertRoleDeletable(role: { isSystem: boolean; userCount: number }): void {
  if (role.isSystem) {
    throw new LockoutError("Super Admin cannot be deleted.");
  }
  if (role.userCount > 0) {
    const people = role.userCount === 1 ? "1 team member" : `${role.userCount} team members`;
    throw new LockoutError(
      `This role is still assigned to ${people}. Move them to another role first.`
    );
  }
}

/**
 * Rules 2 and 3: nobody edits their own access, and the last Super Admin stays.
 *
 * `remainingSuperAdmins` counts the holders *including* the target, so 1 means
 * the target is the only one left.
 */
export function assertAssignable(opts: {
  actorId: string;
  targetId: string;
  targetIsSuperAdmin: boolean;
  remainingSuperAdmins: number;
}): void {
  if (opts.actorId === opts.targetId) {
    throw new LockoutError(
      "You cannot change your own role or revoke your own access. Ask another Super Admin."
    );
  }
  if (opts.targetIsSuperAdmin && opts.remainingSuperAdmins <= 1) {
    throw new LockoutError(
      "This is the last Super Admin. Promote someone else before changing this account."
    );
  }
}
