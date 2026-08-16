import { describe, expect, it } from "vitest";
import { parseAuditDateRange } from "@/lib/audit-filter";

describe("parseAuditDateRange", () => {
  it("returns undefined when neither bound is given", () => {
    expect(parseAuditDateRange()).toBeUndefined();
    expect(parseAuditDateRange("", "")).toBeUndefined();
  });

  it("parses a valid from/to pair", () => {
    const range = parseAuditDateRange("2026-01-01", "2026-01-31");
    expect(range?.gte).toEqual(new Date("2026-01-01"));
    expect(range?.lte).toEqual(new Date("2026-01-31"));
  });

  it("parses a from-only bound", () => {
    const range = parseAuditDateRange("2026-01-01", undefined);
    expect(range?.gte).toEqual(new Date("2026-01-01"));
    expect(range?.lte).toBeUndefined();
  });

  it("parses a to-only bound", () => {
    const range = parseAuditDateRange(undefined, "2026-01-31");
    expect(range?.gte).toBeUndefined();
    expect(range?.lte).toEqual(new Date("2026-01-31"));
  });

  it("drops an unparseable from, keeping a valid to", () => {
    const range = parseAuditDateRange("not-a-date", "2026-01-31");
    expect(range?.gte).toBeUndefined();
    expect(range?.lte).toEqual(new Date("2026-01-31"));
  });

  it("drops an unparseable to, keeping a valid from", () => {
    const range = parseAuditDateRange("2026-01-01", "also-not-a-date");
    expect(range?.gte).toEqual(new Date("2026-01-01"));
    expect(range?.lte).toBeUndefined();
  });

  it("returns undefined when both bounds are unparseable", () => {
    expect(parseAuditDateRange("nope", "still-nope")).toBeUndefined();
  });

  it("keeps both bounds of an inverted range (from later than to) instead of dropping them", () => {
    // Unlike an unparseable string, both dates here are valid — just typed in
    // the wrong order — so this must NOT collapse to undefined (which would
    // silently show the entire unfiltered log instead of narrowing it).
    const range = parseAuditDateRange("2026-06-01", "2026-01-01");
    expect(range?.gte).toEqual(new Date("2026-06-01"));
    expect(range?.lte).toEqual(new Date("2026-01-01"));
    // The returned interval is empty by construction: no Date can be both
    // >= this gte and <= this lte, so a Prisma query built from it is
    // guaranteed to match zero rows — narrowing, never widening.
    expect(range!.gte!.getTime()).toBeGreaterThan(range!.lte!.getTime());
  });

  it("never throws, however garbage the input", () => {
    expect(() => parseAuditDateRange("not-a-date", "not-a-date")).not.toThrow();
    expect(() => parseAuditDateRange("💥", "🔥")).not.toThrow();
  });
});
