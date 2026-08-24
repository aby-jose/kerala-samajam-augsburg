# kerala-samajam-augsburg

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Database backups

Every hour, `.github/workflows/db-backup.yml` dumps the database (everything
except session/token tables — see `scripts/lib/backup-models.ts`), encrypts
it, and uploads it to a private Cloudflare R2 bucket. Checkpoints are kept
hourly for 7 days, then thinned to one per day out to 90 days.

Setup (one-time, see `docs/superpowers/specs/2026-08-24-db-backup-design.md`
for the full design):

1. Create a private R2 bucket and a scoped API token (Object Read & Write,
   restricted to that bucket).
2. Generate an encryption key: `openssl rand -hex 32`. Store it in a
   password manager — losing it makes existing checkpoints unreadable.
3. Add `DATABASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `BACKUP_ENCRYPTION_KEY` as GitHub
   Actions repository secrets.
4. To run any of the commands below locally, put the same values in your
   `.env` — the scripts load it via `dotenv` and will fail without
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
   and `BACKUP_ENCRYPTION_KEY`. GitHub Actions secrets are not visible to
   your machine.

Commands:

- `npm run backup:list` — list available checkpoints.
- `npx tsx scripts/restore-db.ts --key <checkpoint>` — preview a restore
  (row-count diff only, writes nothing).
- `npx tsx scripts/restore-db.ts --key <checkpoint> --confirm` — actually
  restore that checkpoint. This wipes and reloads every included
  collection; there is no undo except restoring a different checkpoint.
