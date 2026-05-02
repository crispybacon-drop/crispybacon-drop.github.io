import type { Surface } from "./types";

export const surfaceClasses: Record<
  Surface,
  {
    text: string;
    bg: string;
    bgSoft: string;
    border: string;
    ring: string;
    glow: string;
    button: string;
    dot: string;
  }
> = {
  carpet: {
    text: "text-surface-carpet",
    bg: "bg-surface-carpet",
    bgSoft: "bg-surface-carpet/10",
    border: "border-surface-carpet",
    ring: "ring-surface-carpet",
    glow: "",
    button: "bg-surface-carpet text-white hover:brightness-110",
    dot: "bg-surface-carpet",
  },
  clay: {
    text: "text-surface-clay",
    bg: "bg-surface-clay",
    bgSoft: "bg-surface-clay/10",
    border: "border-surface-clay",
    ring: "ring-surface-clay",
    glow: "",
    button: "bg-surface-clay text-white hover:brightness-110",
    dot: "bg-surface-clay",
  },
  hard: {
    text: "text-surface-hard",
    bg: "bg-surface-hard",
    bgSoft: "bg-surface-hard/10",
    border: "border-surface-hard",
    ring: "ring-surface-hard",
    glow: "",
    button: "bg-surface-hard text-white hover:brightness-110",
    dot: "bg-surface-hard",
  },
};

/** Format minutes as "1h 30m" (or "45m" / "2h"). Negative or NaN → "0m". */
export function formatDuration(min: number) {
  const safe = Math.max(0, Math.floor(Number(min) || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Decimal hours formatted as "1h 30m". */
export function formatHours(hours: number) {
  return formatDuration(Math.round((Number(hours) || 0) * 60));
}

/** Format an HH:MM string by stripping a leading zero ("09:30" → "9:30"). */
export function formatStartTime(t: string | undefined | null) {
  if (!t) return "";
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  return `${parseInt(m[1], 10)}:${m[2]}`;
}

export function matchOutcome(sets: { me: number | null; opp: number | null }[]) {
  let me = 0;
  let opp = 0;
  for (const s of sets) {
    if (s.me == null || s.opp == null) continue;
    if (s.me > s.opp) me++;
    else if (s.opp > s.me) opp++;
  }
  if (me === opp) return { me, opp, result: "draw" as const };
  return { me, opp, result: me > opp ? ("win" as const) : ("loss" as const) };
}
