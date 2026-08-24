/**
 * Tiered retention for uploaded checkpoints: keep everything under 7 days
 * old, thin 7-90 day checkpoints to one per UTC calendar day (the earliest
 * that day), and drop anything 90 days or older. Run after every successful
 * upload against the full bucket listing.
 */
export interface Checkpoint {
  key: string;
  timestamp: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-08-24T14-00-00Z" — colon-free so it's a safe object key segment. */
export function formatTimestampKey(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-");
}

export function parseTimestampFromKey(key: string): Date | null {
  const match = key.match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z/);
  if (!match) return null;
  const [, date, hh, mm, ss] = match;
  const parsed = new Date(`${date}T${hh}:${mm}:${ss}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function checkpointsToDelete(checkpoints: Checkpoint[], now: Date): string[] {
  const sorted = [...checkpoints].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
  const dailyKept = new Set<string>();
  const toDelete: string[] = [];

  for (const checkpoint of sorted) {
    const ageMs = now.getTime() - checkpoint.timestamp.getTime();
    if (ageMs < 7 * DAY_MS) continue; // hourly resolution, keep all
    if (ageMs >= 90 * DAY_MS) {
      toDelete.push(checkpoint.key);
      continue;
    }
    const dayKey = checkpoint.timestamp.toISOString().slice(0, 10);
    if (dailyKept.has(dayKey)) {
      toDelete.push(checkpoint.key);
    } else {
      dailyKept.add(dayKey);
    }
  }
  return toDelete;
}
