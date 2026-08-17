# Deploying the role-based access control feature

This is the one-time sequence for taking the RBAC feature from a merged
branch to a live deployment, and the recovery path if it is run out of
order. See [the design doc](superpowers/specs/2026-08-16-rbac-design.md) for
the feature itself; this page is deployment mechanics only.

## Required order

1. **`npx prisma db push`** — creates the `Role` and `StaffInvite`
   collections and adds `staffRoleId` to `User`. Schema-only; touches no
   existing document.
2. **`npm run seed:roles`** — creates the six preset roles (Super Admin,
   Event Manager, Treasurer, Content Editor, Gallery Moderator, Viewer) if
   they don't already exist, then assigns every existing administrator —
   including one currently suspended — to Super Admin if they don't already
   hold a staff role. Idempotent: safe to run again, and it never edits a
   role the committee has already customised.
3. **Deploy the application code.**

Steps 1 and 2 are cheap (seconds) and safe to run ahead of a deploy window;
step 2 in particular should run again after any deploy that could have
created a new administrator account outside the normal invite flow (a
break-glass insert, a restored backup, etc.).

## What breaks if the app is deployed first

If the new application code reaches production before steps 1–2 have run —
or before step 2 specifically, since `db push` alone leaves every existing
`User.staffRoleId` at `null` — every current administrator keeps the portal
gate (`role: "ADMIN"`) but holds no staff role:

- **Sign-in succeeds.** The credentials check is unchanged; a correct
  password still establishes a session.
- **Every admin page bounces back to `/admin/login`.** `getStaffContext()`
  (`src/lib/guards.ts`) resolves `staffRole` from the database on every
  request; a `null` role resolves the whole context to `null` regardless of
  the token. `requirePermissionPage()` treats a `null` context as "not
  signed in" and redirects to `/admin/login` — so a freshly-authenticated
  administrator lands back on the sign-in page with no explanation, and if
  the login page then re-attempts its normal post-login redirect, this can
  loop.
- **`/admin/no-access` doesn't help — it 500s.** That page is guarded by
  `requireStaff()`, not `requirePermissionPage()`, and `requireStaff()`
  *throws* on a `null` context rather than redirecting (see its docstring:
  it exists to be the one page that can never itself deny access, on the
  assumption that anyone who can reach it is already known to be staff). An
  uncaught throw from a server component's render is an unhandled error, so
  Next.js renders it as a 500 rather than the friendly "your role doesn't
  include this page" message the page is meant to show.

In short: nobody is destructively locked out — no data is touched, no
password is invalidated — but the admin portal is completely unusable until
step 2 has run against the same database the app is pointed at.

## Recovery (break-glass)

If this happens anyway — the app is already live and every administrator is
stuck — either run `npm run seed:roles` against the same `DATABASE_URL` the
app uses (preferred; it fixes every affected account in one pass and is
exactly what should have run first), or, if the seed script itself is
unavailable, assign one administrator directly via `mongosh` so they can
sign in and invite everyone else properly through `/admin/staff`:

```js
// Connect to the same database DATABASE_URL points at, then:

// 1. Find the Super Admin role. If prisma/seed-roles.ts has never run at
//    all, the Role collection may not have it yet — create it directly:
let superAdmin = db.Role.findOne({ name: "Super Admin" });
if (!superAdmin) {
  const { insertedId } = db.Role.insertOne({
    name: "Super Admin",
    description: "Unrestricted access, including staff and role management.",
    // Deliberately empty — Super Admin's permission set is computed from
    // the live catalogue, never stored. See src/lib/rbac/resolve.ts.
    permissions: [],
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  superAdmin = { _id: insertedId };
}

// 2. Point one locked-out administrator at it — enough to sign in and
//    finish the job from the Staff screen.
db.User.updateOne(
  { email: "admin@example.org" },       // the account to recover
  { $set: { staffRoleId: superAdmin._id } }
);
```

After this, sign in as that administrator, confirm `/admin/staff` shows
everyone correctly, and run `npm run seed:roles` properly (or use the Staff
screen) to backfill anyone else still affected.

## Deploying the page-content feature

The `feature/page-content` branch (contact, membership and events/gallery
pages made admin-editable) adds one collection and one permission. Neither
is destructive, and both are cheap to run ahead of a deploy window like
steps 1–2 above:

1. **`npx prisma db push`** — creates the `PageContent` collection (see
   `prisma/schema.prisma`). Schema-only; touches no existing document. Until
   this has run, every save through `/admin/pages/[slug]` fails, but the
   public `/contact`, `/membership`, `/events` and `/gallery` pages keep
   rendering their built-in defaults regardless — `mergePageContent` treats
   a missing document exactly like an empty one.
2. **Grant `content.pages.edit`** to whichever roles should be able to save
   these pages. It gates all three "Contact Page", "Membership Page" and
   "Events & Gallery" nav entries and their `/admin/pages/*` routes. The
   seeded "Content Editor" preset already carries it as of this branch; a
   deployment on an older seed, or a committee that has already customised
   its roles, should add it to "Content Editor" (or wherever it belongs)
   through `/admin/roles` so those nav entries aren't dead for everyone who
   should have them.

## Note on suspended administrators

`npm run seed:roles` backfills `role: "ADMIN"` **and** `role:
"SUSPENDED_ADMIN"` accounts with no staff role. A suspended administrator
still can't sign in — suspension is untouched by this — but if they are
later reinstated (which only strips the `SUSPENDED_` prefix off `role`),
they land back with a working staff role instead of the portal gate and zero
permissions. Re-run the seed after reinstating anyone whose suspension
predates it having run at all, just in case.
