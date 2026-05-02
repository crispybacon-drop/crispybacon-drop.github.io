/**
 * Shared date formatting utility.
 *
 * Pinned to "en-GB" so server-rendered HTML and the client hydration produce
 * identical strings (otherwise the locale defaults differ between the SSR
 * Worker runtime and the user's browser, causing React hydration mismatches).
 */

const LOCALE = "en-GB";

export type DateLike = string | number | Date;

function asDate(d: DateLike): Date {
  return d instanceof Date ? d : new Date(d);
}

export function formatDate(
  d: DateLike,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  return asDate(d).toLocaleDateString(LOCALE, opts);
}

export function formatDayShort(d: DateLike): string {
  return asDate(d).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}

export function formatDayLong(d: DateLike): string {
  return asDate(d).toLocaleDateString(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatMonth(d: DateLike): string {
  return asDate(d).toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
}

export function formatMonthShort(d: DateLike): string {
  return asDate(d).toLocaleDateString(LOCALE, { month: "short" });
}

/** ISO yyyy-mm-dd (local-time based, matches what we store on Session.date). */
export function toIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
