import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Every date shown on the site — events, memberships, payments — is
 * effectively Augsburg-local, so formatting is pinned to it explicitly
 * rather than left to `Intl`'s default of "wherever this code happens to
 * run." Server-rendered pages hydrate on the client, and without a fixed
 * zone the two renders read the *runtime's* local clock: a server on UTC
 * and a browser on Europe/Berlin can disagree about which calendar day an
 * event near midnight falls on, and React throws a hydration mismatch
 * (error #418) the moment the server- and client-rendered text differ.
 */
const EVENT_TIME_ZONE = "Europe/Berlin";

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: EVENT_TIME_ZONE,
  }).format(new Date(date));
}

/** Day-of-month, zero-padded — e.g. the "07" in a date-block digit pair. */
export function formatDayNumber(date: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    timeZone: EVENT_TIME_ZONE,
  }).format(new Date(date));
}

export function formatMonthShort(date: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    timeZone: EVENT_TIME_ZONE,
  }).format(new Date(date));
}

export function formatWeekday(date: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: EVENT_TIME_ZONE,
  }).format(new Date(date));
}

/** "Saturday, 7 June 2026" — the event detail page's long-form date. */
export function formatFullDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: EVENT_TIME_ZONE,
  }).format(new Date(date));
}

export function formatClockTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: EVENT_TIME_ZONE,
  }).format(new Date(date));
}

export function truncate(str: string, length: number) {
  return str.length > length ? str.substring(0, length) + "..." : str;
}

/**
 * Pull a message out of a caught value without widening it to `any`.
 * A server action can reject with an Error, a string, or something else
 * entirely, so the fallback matters.
 */
export function getErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

export function exportToCSV(headers: string[], data: any[][], filename: string) {
  const csvContent = [
    headers.join(","),
    ...data.map(row => row.map(cell => {
      const cellStr = String(cell ?? "");
      // Handle commas and quotes in CSV
      if (cellStr.includes(",") || cellStr.includes("\"") || cellStr.includes("\n")) {
        return `"${cellStr.replace(/"/g, "\"\"")}"`;
      }
      return cellStr;
    }).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
