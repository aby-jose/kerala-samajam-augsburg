# Role-Based Access Control — Design

Date: 2026-08-16
Status: Approved for planning

## 1. Problem

The admin portal has exactly one privilege level. `User.role` is either `ADMIN`
or it is not, and all 63 `requireAdmin()` call sites across 12 action files —
plus 4 `requireAdminPage()` guards — ask the same question. A
volunteer brought in to approve event photos gets the same access as the
treasurer: they can reverse payments, export the consent register, erase member
accounts, and rewrite the privacy policy.

There is also no way to bring someone on board. Creating an administrator today
means editing a database row by hand, and there is no mechanism for handing
somebody their first credentials.

## 2. Goals

- Every server action is associated with exactly one permission, enforced
  mechanically rather than by convention.
- Roles are composed of permissions and are editable by administrators without
  a deploy.
- New staff are invited by email and set their own password before they ever
  reach the portal.
- Who did what is recorded.

## 3. Non-goals

Deliberately excluded; each can be added later without rework.

- Per-user permission overrides on top of a role.
- Permissions on the member-facing side. Member capability stays where it is:
  event registration, gallery contribution eligibility, and profile management
  are governed by the rules already in place.
- Time-boxed or scheduled role assignments.
- Two-factor authentication and IP allowlisting.

## 4. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Roles live in the database and are admin-editable; the permission catalogue lives in code | Committee composition changes yearly. Role *composition* must not require a deploy; the catalogue must stay typed. |
| D2 | `User.role` keeps its current meaning as the portal gate; a new `staffRoleId` carries the granular role | Smallest blast radius. [proxy.ts](../../../src/proxy.ts), the login path and the suspension logic keep working untouched. |
| D3 | `requirePermission()` reads the role from the database on every call, not from the JWT | Revocation takes effect on the next click rather than up to `ROLE_REFRESH_INTERVAL_MS` later, and the session cookie does not grow by ~1KB. |
| D4 | Explicit `await requirePermission("…")` at the top of each action, backed by a coverage test | The guard stays visible where it applies, and omission fails the build. |
| D5 | Invites are single-use hashed token links; no password is ever emailed | "Must reset after first login" is satisfied by construction — the first login *is* the password creation. |
| D6 | No `User` row is created until an invite is accepted | Avoids passwordless half-accounts accumulating behind revoked invites. |
| D7 | Promotion of an existing member uses the same token link and sets a fresh password | Re-proves mailbox control before granting admin, and replaces a possibly-weak member password. |
| D8 | Verb-level granularity (55 keys), not resource-level | Separates recording a payment from reversing one, and editing an event from mass-mailing every member. |
| D9 | Super Admin's permission set is computed as "all", never stored | A stored array silently omits permissions added in a later release. |
| D10 | `uploadImageAction`'s folder escape requires `gallery.media.upload` | Otherwise any staff account, including one with no gallery rights, bypasses the contribution quarantine. |
| D11 | Vitest is added to the project | The coverage guarantee and the invite/lockout logic both need somewhere to run. |

### D7 — accepted consequence

The password is shared between the public site and the admin portal. A member
promoted to staff therefore changes the password they use on the public site as
part of accepting the invite. This is intended, and the invite email must say so.

### D10 — accepted consequence

Permissions resolve against the *admin* session. An administrator signed in on
the public site has no admin cookie, so an upload made there lands in the
contribution queue rather than the live gallery. This is a behaviour change from
today, and it is the behaviour [guards.ts](../../../src/lib/guards.ts) already
states it wants: "Admin capability is reached through the admin portal or not at
all."

## 5. Architecture

Four layers, each with a single responsibility.

| Layer | Location | Responsibility |
|---|---|---|
| Catalogue | `src/lib/permissions.ts` (new) | What permissions exist |
| Storage | `Role` collection | Which permissions a role holds |
| Guard | [guards.ts](../../../src/lib/guards.ts) | Whether this caller may do this |
| Perimeter | [proxy.ts](../../../src/proxy.ts) | Whether this caller is staff at all |

Middleware runs on the Edge runtime and cannot reach the database, so
[proxy.ts](../../../src/proxy.ts) stays a coarse "is staff" gate. Per-route
permission checks live in `requirePermissionPage()` inside each page, which
already has to run for the page to render its data safely.

### Timing guarantees

- An individual permission revoked → effective on the caller's next action.
- Staff access revoked entirely (`role → MEMBER`) → effective within
  `ROLE_REFRESH_INTERVAL_MS` (5 minutes) via the existing `jwt` callback in
  [auth.ts](../../../src/lib/auth.ts). Every action in that window still fails
  its permission check, because the role row is gone.

## 6. Schema

```prisma
model Role {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  name        String   @unique
  description String?
  /// Permission keys. Ignored when `isSystem` is true — Super Admin is
  /// computed as the full catalogue so a newly added permission is never
  /// missing from the one role that must hold everything.
  permissions String[]
  isSystem    Boolean  @default(false)
  users       User[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model StaffInvite {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  email       String
  /// sha256 of the token. The raw value exists only in the email, so a
  /// database read does not yield working invite links.
  tokenHash   String    @unique
  roleId      String    @db.ObjectId
  role        Role      @relation(fields: [roleId], references: [id])
  invitedById String    @db.ObjectId
  expires     DateTime
  acceptedAt  DateTime?
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())

  @@index([email])
  @@index([expires])
}

model AuditLog {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  actorId    String?  @db.ObjectId
  /// Denormalised so the entry survives the actor's deletion or anonymisation.
  actorEmail String
  /// The permission key that authorised the call.
  action     String
  entity     String?
  entityId   String?
  summary    String
  metadata   Json?
  /// Hashed, consistent with the existing UserConsent treatment.
  ipHash     String?
  createdAt  DateTime @default(now())

  @@index([actorId, createdAt])
  @@index([entity, entityId])
  @@index([action, createdAt])
}
```

`User` gains:

```prisma
  staffRoleId String? @db.ObjectId
  staffRole   Role?   @relation(fields: [staffRoleId], references: [id])
```

`User.role`, `User.status` and the `SUSPENDED_*` convention are unchanged.

### Note on existing token storage

[PasswordResetToken](../../../prisma/schema.prisma) stores raw tokens. Invites
grant administrative access, so they are hashed. Retrofitting the password reset
table is out of scope here but should be recorded as a follow-up.

## 7. Permission catalogue

55 keys in `resource.verb` form, typed as `keyof typeof PERMISSIONS`. Each entry
carries a display group, a human label, and a `mutates` flag that drives
automatic audit logging.

Most keys gate one or more server actions. A few gate only a page — they appear
in the mapping table with their route instead, and the catalogue test counts a
page guard as a valid reference.

```ts
export const PERMISSIONS = {
  "events.view":    { group: "Events", label: "View events",  mutates: false },
  "events.delete":  { group: "Events", label: "Delete events", mutates: true },
  // …
} as const;

export type Permission = keyof typeof PERMISSIONS;
```

### Mapping to existing actions

| Permission | Actions |
|---|---|
| `dashboard.view` | `getAdminDashboardStats` |
| `events.view` | `getAdminEvents` |
| `events.edit` | `upsertEvent` |
| `events.publish` | `toggleEventPublish` |
| `events.delete` | `deleteEvent` |
| `events.cancel` | `cancelEvent`, `reinstateEvent` |
| `events.announce` | `announceEvent` |
| `events.ai` | `generateEventImage`, `generateEventDetails`, `improveEventTitle`, `improveEventDescription`, `generateCategory` |
| `registrations.view` | `getRegistrationsByEvent` |
| `registrations.edit` | `updateRegistrationAmount` |
| `registrations.checkin` | `toggleCheckIn`, `getRegistrationByTicketId` |
| `registrations.delete` | `deleteRegistration` |
| `registrations.ticket` | `sendEventTicket` |
| `payments.view` | `getAllPayments`, `getMembershipPaymentDetails` |
| `payments.record` | `recordRegistrationPayment`, `recordSubscriptionPayment` |
| `payments.revert` | `revertRegistrationPayment`, `revertSubscriptionPayment` |
| `payments.invoice` | `sendMembershipPaymentRequest`, `sendSubscriptionReceipt` |
| `members.view` | `getAllMembers` |
| `members.edit` | `updateMemberDetails` |
| `members.suspend` | `suspendUser` |
| `members.erase` | `completeAccountDeletion` |
| `membership.plans.view` | `getMembershipPlans` |
| `membership.plans.edit` | `upsertMembershipPlan`, `togglePlanStatus` |
| `membership.plans.delete` | `deleteMembershipPlan` |
| `membership.applications.view` | `getPendingSubscriptions` |
| `membership.applications.approve` | `approveMembership`, `rejectMembership`, `resetRejectedSubscription` |
| `membership.applications.cancel` | `cancelSubscriptionAsAdmin` |
| `gallery.view` | Pages `/admin/gallery`, `/admin/gallery/[id]` (page guard only) |
| `gallery.albums.edit` | `createAlbum`, `updateAlbum` |
| `gallery.albums.delete` | `deleteAlbum` |
| `gallery.media.upload` | `addMediaToAlbum`, `uploadImageAction` (folder escape only) |
| `gallery.media.delete` | `deleteMedia`, `bulkDeleteMedia` |
| `gallery.contributions.view` | `getPendingContributions` |
| `gallery.contributions.moderate` | `moderateContribution`, `bulkModerateContributions` |
| `content.about.edit` | `saveAboutContent` |
| `content.leadership.edit` | `upsertLeadershipMember`, `deleteLeadershipMember`, `updateLeadershipOrder` |
| `inquiries.view` | `getContactMessages` |
| `inquiries.manage` | `updateMessageStatus` |
| `inquiries.delete` | `deleteMessage` |
| `legal.view` | `adminListLegalDocuments`, `adminGetLegalDocument`, `adminListRevisions`, `adminGetRevision`, `adminLegalDocumentCount` |
| `legal.edit` | `adminSaveDraft` |
| `legal.publish` | `adminPublishVersion`, `adminSetPublished` |
| `legal.consents.view` | `adminListConsents` |
| `legal.consents.export` | `adminExportConsentsCsv` |
| `email.view` | `getEmailLog`, `getEmailHtml` |
| `email.resend` | `resendEmail` |
| `email.test` | `sendTestEmail` |
| `analytics.view` | `getAnalyticsData` |
| `settings.edit` | `saveConfig` |
| `staff.view` | `listStaff` (new) |
| `staff.invite` | `inviteStaff`, `resendInvite`, `revokeInvite` (new) |
| `staff.manage` | `changeStaffRole`, `revokeStaffAccess` (new) |
| `roles.view` | `listRoles` (new) |
| `roles.edit` | `upsertRole`, `deleteRole` (new) |
| `audit.view` | `getAuditLog` (new) |

`fetchConfigAction` is deliberately unguarded — the site cannot render without
it — and goes on the `UNGUARDED_ACTIONS` allowlist with that justification.

### Seeded presets

Created by the seed script, editable afterwards.

| Preset | Permissions |
|---|---|
| **Super Admin** | Everything (computed, `isSystem: true`) |
| **Event Manager** | `dashboard.view`, all `events.*`, all `registrations.*`, `payments.view`, `gallery.view`, `gallery.albums.edit`, `gallery.media.upload` |
| **Treasurer** | `dashboard.view`, all `payments.*`, all `membership.*`, `members.view`, `registrations.view`, `analytics.view` |
| **Content Editor** | `content.about.edit`, `content.leadership.edit`, `events.view`, `gallery.view`, `gallery.albums.edit`, `gallery.media.upload`, `legal.view`, `inquiries.view`, `inquiries.manage` |
| **Gallery Moderator** | all `gallery.*`, `events.view`, `registrations.view` |
| **Viewer** | Every `.view` key, nothing else |

## 8. Guard layer

Extends [guards.ts](../../../src/lib/guards.ts). Existing member-side helpers
(`getCurrentUser`, `requireUser`) are unchanged.

```ts
/** Resolved once per request via React cache(). */
export const getStaffContext: () => Promise<StaffContext | null>;

interface StaffContext {
  id: string;
  email: string;
  name: string | null;
  roleName: string;
  permissions: ReadonlySet<Permission>;
  has(permission: Permission): boolean;
}

/** Throws "Unauthorized" unless held. Auto-audits when the key mutates. */
export function requirePermission(p: Permission): Promise<StaffContext>;

/** Redirects to /admin/login unless held. For server components. */
export function requirePermissionPage(p: Permission): Promise<StaffContext>;

/** Boolean, for rendering. Never a substitute for the above. */
export function can(p: Permission): Promise<boolean>;

/** "Any staff", for genuinely shared actions. Replaces bare requireAdmin(). */
export function requireStaff(): Promise<StaffContext>;
```

`requireAdmin()` and `requireAdminPage()` are removed. Each of the 63
`requireAdmin()` call sites becomes a `requirePermission()` with the key from the
mapping table in §7; each of the 4 `requireAdminPage()` call sites becomes a
`requirePermissionPage()`.

`uploadImageAction` is the one exception. It already uses `requireAnyUser()`
because members call it too, and it keeps doing so — what changes is the folder
decision, which switches from `user.isAdmin` to a `can("gallery.media.upload")`
check (D10).

### Page guards

The four existing `requireAdminPage()` sites, plus every other admin page that
reads from the database, take the permission that matches the data they render:

| Page | Permission |
|---|---|
| `/admin/gallery`, `/admin/gallery/[id]` | `gallery.view` |
| `/admin/gallery/contributions` | `gallery.contributions.view` |
| `/admin/about` | `content.about.edit` |
| `/admin/legal`, `/admin/legal/[slug]` | `legal.view` |
| `/admin/legal/consents` | `legal.consents.view` |
| `/admin/dashboard` | `dashboard.view` |
| `/admin/events` | `events.view` |
| `/admin/registrations` | `registrations.view` |
| `/admin/check-in/[eventId]` | `registrations.checkin` |
| `/admin/payments` | `payments.view` |
| `/admin/members` | `members.view` |
| `/admin/membership` | `membership.plans.view` |
| `/admin/membership/applications` | `membership.applications.view` |
| `/admin/inquiries` | `inquiries.view` |
| `/admin/leadership` | `content.leadership.edit` |
| `/admin/analytics` | `analytics.view` |
| `/admin/emails` | `email.view` |
| `/admin/settings`, `/admin/config` | `settings.edit` |

Pages currently relying on the layout or middleware alone gain an explicit guard
here. This is the audit that turns "the middleware protects `/admin/*`" into a
per-page statement of what each page needs, which is what makes the nav
filtering in §12 truthful.

Per-request memoisation via React `cache()` means a page rendering several
guarded calls performs one role lookup, not several.

## 9. Invite and onboarding

### Inviting

`inviteStaff(email, roleId)` requires `staff.invite`.

1. Reject if a pending, unexpired, unrevoked invite already exists for that
   address.
2. Create a `StaffInvite` with a 32-character nanoid token, stored hashed, with
   a 72-hour expiry. No `User` row is created (D6).
3. Send the invite email with a link to `/admin/invite/<token>`.

The email states the role being granted, who invited them, when the link
expires, and — for an address that already has a member account — that setting
this password will also change the password they use on the public site.

### Accepting

`/admin/invite/<token>` validates that the invite exists, is unexpired,
unaccepted and unrevoked. Invalid tokens produce one generic message; they must
not reveal whether an address has an account.

On submission of a valid password (reusing the strength rules already applied in
[`resetPassword`](../../../src/lib/auth-actions.ts)):

1. Create the user, or update the existing member with that address.
2. Set `role: "ADMIN"`, `staffRoleId`, the hashed password, `passwordChangedAt`
   and `emailVerified`.
3. Mark the invite accepted. The token is single-use.
4. Write an audit entry.
5. Redirect to `/admin/login` with a success banner.

Not auto-signed-in: the admin credentials provider requires a captcha, and
re-entering the password confirms what was just set.

`passwordChangedAt` is set on acceptance, so per the existing `jwt` callback any
session predating the promotion is invalidated.

### Managing

- `resendInvite` — revokes the outstanding token and mints a new one, so an old
  link in an inbox stops working.
- `revokeInvite` — sets `revokedAt`. Since no `User` row exists, nothing is left
  behind.
- `changeStaffRole`, `revokeStaffAccess` — require `staff.manage`.
  Revocation sets `role: "MEMBER"` and clears `staffRoleId`; the member account
  and its history survive.

## 10. Lockout safety

Enforced in the actions and covered by tests.

1. The Super Admin role cannot be deleted, renamed, or have permissions
   unticked.
2. The last user holding Super Admin cannot be demoted, revoked, or suspended.
3. No user may change their own role, revoke their own access, or delete their
   own staff account. Another Super Admin does it.
4. A role with users assigned cannot be deleted; they must be reassigned first.

## 11. Audit log

`requirePermission()` writes a baseline entry automatically whenever the
permission's `mutates` flag is true — actor, permission key, timestamp, hashed
IP. This guarantees a floor: no mutating action goes unlogged, even if its author
forgot.

Actions may enrich the entry created in the current request with
`describeAudit({ summary, entity, entityId, metadata })` — for example
"Recorded €120 bank transfer for Priya Menon's Family membership".

`/admin/audit` lists entries filtered by actor, permission, entity and date
range, and requires `audit.view`.

## 12. UI surface

### Filtering

The admin layout resolves the permission set once and passes it to the client
nav. Nav items whose permission is absent are hidden; groups with no visible
items disappear entirely. Action buttons within pages are gated the same way.
Server guards remain authoritative — hiding is courtesy, never enforcement.

### New screens

| Route | Permission | Contents |
|---|---|---|
| `/admin/staff` | `staff.view` | Staff list with role, last sign-in, and pending invites; invite, resend, revoke, change role |
| `/admin/roles` | `roles.view` | Role list and the permission matrix, grouped by the catalogue's `group` field |
| `/admin/audit` | `audit.view` | Filterable log |
| `/admin/invite/[token]` | none | Public accept page |

Both new admin screens sit under the existing **System** nav group.

## 13. Migration and seeding

MongoDB, so `prisma db push`. An idempotent `scratch/seed-roles.ts` follows the
convention already established by `scratch/migrate-offline-payments.ts`:

1. Create the six preset roles if absent.
2. **Assign every existing user with `role === "ADMIN"` to Super Admin.**
3. Report what it changed and make no destructive edits.

Step 2 is the highest-risk item in this work. Without it, every current
administrator is left holding the portal gate with no permissions and the site
becomes unadministrable on deploy. The seed must run before or with the first
request that reaches the new guard.

## 14. Testing

Vitest is added, with `npm test` and `npm run test:watch`.

### Coverage test

Walks every exported function in `src/lib/*-actions.ts` and asserts that each
either calls a guard (`requirePermission`, `requireStaff`, `requireUser`,
`requireAnyUser`) or appears on an `UNGUARDED_ACTIONS` allowlist with a
justifying comment. This is what makes the "every action has a permission"
requirement mechanical rather than aspirational.

### Catalogue test

Every permission referenced in code exists in `PERMISSIONS`; every key in
`PERMISSIONS` is referenced somewhere. Catches typos and dead keys.

### Unit tests

- Guard: allows a held permission, denies a missing one, Super Admin holds a
  permission added after its row was created, a revoked role denies immediately.
- Invite: expired token rejected; accepted token cannot be reused; revoked token
  rejected; acceptance stores a hashed password and sets `passwordChangedAt`;
  a resend invalidates the prior token.
- Lockout: all four rules in §10.
- Upload: a staff account without `gallery.media.upload` is sandboxed to the
  contribution folder.

## 15. Risks

| Risk | Mitigation |
|---|---|
| Seed does not run; all administrators locked out | Seed is idempotent and runs as an explicit deploy step; document a break-glass path that assigns Super Admin directly |
| A `requireAdmin()` call site is converted to the wrong permission | The mapping table in §7 is the reference; conversions are reviewed against it |
| An action is added later with no guard | Coverage test fails the build |
| Admins confused by the upload behaviour change (D10) | Note it in the release summary; the contribution queue makes the outcome visible rather than silent |
| Session still shows stale nav for up to 5 minutes after revocation | Every action fails its check immediately; only the cosmetic nav lags |
