/**
 * Shared KPI math for the admin dashboard and analytics page, so a metric
 * doesn't read one way on one screen and a different way on the other.
 */

/**
 * Percentage change from `previous` to `current`.
 *
 * Returns null when there is nothing to compare against — a first month, or a
 * metric that was zero. Growing from 0 to 5 is not "+500%", and printing
 * "+0.0%" next to a real number reads as a measurement rather than an absence.
 * The card hides the delta entirely in that case.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Render a month-on-month change, or nothing when there is no baseline.
 *
 * `null` means the metric was zero a month ago — a first month, or the first
 * paid registration. Showing "+100%" or "+0.0%" there would present the
 * absence of a comparison as a measurement.
 */
export function formatDelta(change: number | null | undefined): string | undefined {
  if (change == null || !Number.isFinite(change)) return undefined;
  const rounded = Math.round(change * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${Math.abs(rounded).toFixed(1)}%`;
}
