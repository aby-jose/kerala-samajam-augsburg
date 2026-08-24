import { describe, expect, it } from "vitest";
import {
  formatTimestampKey,
  parseTimestampFromKey,
  checkpointsToDelete,
  type Checkpoint,
} from "../scripts/lib/retention";

describe("checkpoint key formatting", () => {
  it("formats a date as a colon-free ISO timestamp", () => {
    expect(formatTimestampKey(new Date("2026-08-24T14:00:00.000Z"))).toBe(
      "2026-08-24T14-00-00Z"
    );
  });

  it("parses a formatted key back to the same instant", () => {
    const key = "db-backups/2026-08-24T14-00-00Z.json.gz.enc";
    expect(parseTimestampFromKey(key)?.toISOString()).toBe(
      "2026-08-24T14:00:00.000Z"
    );
  });

  it("returns null for a key with no timestamp", () => {
    expect(parseTimestampFromKey("db-backups/not-a-timestamp.json.gz.enc")).toBeNull();
  });
});

describe("checkpointsToDelete", () => {
  const NOW = new Date("2026-08-24T00:00:00.000Z");
  const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
  const cp = (key: string, age: number): Checkpoint => ({ key, timestamp: daysAgo(age) });

  it("keeps everything younger than 7 days", () => {
    const checkpoints = [cp("h1", 0.1), cp("h2", 3), cp("h3", 6.9)];
    expect(checkpointsToDelete(checkpoints, NOW)).toEqual([]);
  });

  it("thins 7-90 day checkpoints to one per UTC day, keeping the earliest", () => {
    const checkpoints: Checkpoint[] = [
      { key: "d1-early", timestamp: new Date("2026-08-14T01:00:00.000Z") },
      { key: "d1-late", timestamp: new Date("2026-08-14T13:00:00.000Z") },
      { key: "d2-only", timestamp: new Date("2026-08-15T05:00:00.000Z") },
    ];
    expect(checkpointsToDelete(checkpoints, NOW).sort()).toEqual(["d1-late"]);
  });

  it("deletes everything 90 days or older", () => {
    const checkpoints = [cp("old1", 90), cp("old2", 200)];
    expect(checkpointsToDelete(checkpoints, NOW).sort()).toEqual(["old1", "old2"]);
  });
});
