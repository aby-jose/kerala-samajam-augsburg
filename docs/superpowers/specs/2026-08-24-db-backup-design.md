# Database Backup — Design

Date: 2026-08-24
Status: Approved for planning

## 1. Problem

The only backup mechanism today is `scripts/backup-db.ts`, a manual script
that dumps every Mongo collection to local JSON. It has been run exactly
once. It has no schedule, no off-site copy, and no restore path — the DB
dump, and the `.env` credentials needed to even connect, exist only on one
laptop. If that laptop is lost, or a bad admin action wipes data, there is
currently nothing to recover from.

## 2. Goals

- Automatic, unattended backups on an hourly cadence, requiring no one to
  remember to run anything.
- Off-site storage, independent of the laptop and independent of the app's
  own hosting (Vercel).
- Able to restore to a specific point in time, at hourly granularity for
  the last 7 days and daily granularity for the last 90.
- Storage stays bounded automatically (old checkpoints thin out and expire)
  rather than growing forever.
- A restore path that has actually been exercised, not just assumed to
  work.

## 3. Non-goals

- True continuous/point-in-time recovery (any second) — hourly checkpoints
  were chosen as sufficient; per-write oplog capture is materially more
  infrastructure for a community-org site.
- Cloudinary media backup — gallery photos/videos change far less often
  than DB rows and are covered by Cloudinary's own retention; can be
  revisited separately if needed.
- Custom failure alerting — GitHub already emails repo watchers when a
  scheduled workflow fails; no bespoke notification system.
- Backing up short-lived/security-sensitive collections — see D2.

## 4. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Trigger and execution both live in GitHub Actions (`.github/workflows/db-backup.yml`), not Vercel Cron | The app's existing crons (`vercel.json`) run once daily, consistent with the Vercel Hobby plan's daily-only cron limit. Hourly needs either Vercel Pro (~$20/mo) or a mechanism outside Vercel entirely. GitHub Actions is free at this volume, decoupled from the app's hosting plan/tier, and the repo is already on GitHub. |
| D2 | Backup excludes `session`, `account`, `verificationToken`, `passwordResetToken`, `rateLimit`, `captcha` | These are short-lived/security tokens. Restoring them later is meaningless (stale or already expired by restore time) and including live tokens in an off-site archive is pure added exposure with no recovery benefit. `user` (which includes bcrypt password hashes) is kept — hashes are one-way and the account records are genuinely needed to restore who the members are, unlike a live session token. |
| D3 | Storage is Cloudflare R2, one bucket, private, scoped API token | Free tier comfortably covers JSON-dump volumes at this cadence; no egress fees; token scoped to only this bucket so a leaked token can't reach anything else in the Cloudflare account. |
| D4 | Archive is encrypted (AES-256-GCM, Node's built-in `crypto`) before upload, key held only in GitHub Actions secrets | The dump still contains PII (names, emails, phone numbers, addresses) even after D2's exclusions. Encrypting at the point of creation means a misconfigured bucket or compromised R2 account exposes nothing readable. |
| D5 | Tiered retention: hourly kept for 7 days, thinned to one-per-day for the next 90, deleted after 90 | Matches the approved granularity requirement while keeping storage roughly flat forever, run as a sweep after every successful upload. |
| D6 | Restore stays a separate script (`scripts/restore-db.ts`, already exists), run locally by hand only — never in CI, never scheduled. Its existing single-transaction wipe-and-reload (atomic: any failure rolls back everything) is kept as-is, just gated behind D7 | Restore is destructive by nature. Keeping it out of any automated path means it only ever happens as a deliberate, attended action; keeping it atomic means a failure partway through can't leave the database half-restored. |
| D7 | Restore requires `--confirm` — for both a remote `--key <checkpoint>` and the existing local-directory mode; without it, only a before/after row-count diff per collection is printed and nothing is written | Forces a human to see the blast radius (how many rows change) before anything is overwritten — closes a real gap, since the local-directory mode currently restores immediately with no confirmation at all. |
| D8 | Per-model dump failures are caught individually and recorded in a `_summary.json` inside the archive, matching the existing script's pattern | A partial backup must be visibly partial, never mistaken for complete; one bad collection shouldn't abort backing up the other 25. Restore is the opposite by design — see D6. |

## 5. Scope: what gets backed up

26 of the 32 models `scripts/backup-db.ts` currently dumps:

```
config, aboutContent, homeContent, pageContent, legalDocument,
legalRevision, userConsent, cookieConsent, event, registration,
galleryAlbum, galleryMedia, faceDetection, instagramReel,
instagramSyncState, user, emailLog, userFaceProfile, membershipPlan,
subscription, leadershipMember, mediaContribution, contactMessage, role,
staffInvite, auditLog
```

Excluded (D2): `account`, `session`, `verificationToken`,
`passwordResetToken`, `rateLimit`, `captcha`.

## 6. Backup flow

`.github/workflows/db-backup.yml`:

- Triggers: `schedule: '0 * * * *'` (hourly) and `workflow_dispatch` (manual
  run, for testing and on-demand checkpoints).
- Steps: checkout → setup Node → `npm ci` → `npx tsx scripts/backup-db.ts --upload`.
- Secrets (GitHub Actions Secrets, not Vercel env): `DATABASE_URL`,
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
  `BACKUP_ENCRYPTION_KEY`.
- `timeout-minutes: 10` — a dump of this size should take seconds; a
  generous but bounded ceiling catches a hung connection.

`scripts/backup-db.ts --upload` (extends the existing script rather than
replacing it — `--upload` is new, the bare/no-flag local-dump behavior is
unchanged for manual local use):

1. For each model in §5, `findMany()` via Prisma, same per-model try/catch
   as today, writing failures into a summary object instead of aborting.
2. Bundle every model's rows plus `_summary` into one JSON document, then
   gzip it (`zlib`) — compressing before encrypting, since encrypted bytes
   don't compress. No new archive-format dependency; a single gzipped JSON
   document serves the same purpose as a zip of per-model files.
3. Encrypt the gzipped bundle (AES-256-GCM, `BACKUP_ENCRYPTION_KEY`).
4. Upload to R2 (`@aws-sdk/client-s3`, R2's S3-compatible endpoint) as
   `db-backups/<ISO-timestamp>.json.gz.enc`, e.g.
   `db-backups/2026-08-24T14-00-00Z.json.gz.enc`.
5. Run the retention sweep (§7) against the bucket listing.
6. Without `--upload`, behavior is unchanged: writes plaintext JSON to
   `backups/<timestamp>/` locally, as it does today.

## 7. Retention sweep

Runs after every successful upload, idempotent (safe to run repeatedly):

1. List all objects under `db-backups/`, parse timestamps from keys.
2. Age < 7 days: keep all (hourly resolution).
3. 7–90 days: keep only the earliest checkpoint per calendar day (UTC),
   delete the rest.
4. Age > 90 days: delete.

## 8. Restore flow

`scripts/restore-db.ts`, run locally only (D6):

- `--list`: lists checkpoints in the bucket (timestamp, size), newest
  first.
- `--key <key>` (no `--confirm`): downloads and decrypts the archive,
  prints a per-model table of current DB row count vs. archive row count —
  no writes.
- `--key <key> --confirm`: same diff printed first, then restores through
  `scripts/restore-db.ts`'s existing single Mongo transaction — every
  included collection is wiped and reloaded atomically, and any failure
  partway through rolls the whole thing back rather than leaving some
  collections restored and others not. This applies to local-directory
  restores too: `--confirm` is now required there as well (previously it
  ran immediately), closing the gap where a restore could happen with no
  human seeing the blast radius first.

## 9. Error handling

- Per-model dump failure: caught, logged into `_summary.json`, the run
  continues with the remaining models (independent reads, no consistency
  concern between them).
- Restore failure (any model, mid-transaction): the whole restore rolls
  back — deliberately not "continue on a failing model," since collections
  reference each other (e.g. `Registration` → `Event`) and a partial
  restore across them would leave the database in a worse, inconsistent
  state than not restoring at all.
- R2 upload failure: the Action step fails, the whole workflow run shows
  red, GitHub emails repo watchers by default — no bespoke alerting needed.
- Retention sweep failure: logged, does not fail the run — a successful
  backup matters more than pruning old ones exactly on schedule.
- Decryption failure on restore (wrong/rotated key): fails loudly before
  any DB write is attempted.

## 10. Testing

- `--dry-run` on the backup script: runs the full dump + zip + encrypt
  pipeline but skips the R2 upload and retention sweep, for local iteration
  without needing real R2 credentials on every run.
- `workflow_dispatch` gives an on-demand way to verify the Action itself
  end-to-end before waiting for the first scheduled hour.
- One real backup → restore round-trip, verified by hand after
  implementation: run a real backup, restore it into a scratch database (a
  second, throwaway MongoDB Atlas database, not the live one), and confirm
  row counts and a few spot-checked documents match. This is the step that
  was missing before (§1) and is the actual point of this project — a
  restore path that's been proven, not assumed.

## 11. Open questions

None blocking.
