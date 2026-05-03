import { useMemo, useState } from "react";
import { useLocalStorage, STORAGE_KEYS } from "@/lib/storage";
import type { CustomGame, Format, OpponentRating, Player, Session, Surface } from "@/lib/types";
import { OPPONENT_RATINGS } from "@/lib/types";
import { surfaceClasses, matchOutcome, formatDuration, formatHours } from "@/lib/surface";
import { useSurfaceVisibility } from "@/lib/visibleSurfaces";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface Props {
  /** When true, show only the calendar (used inside Sessions tab). */
  calendarOnly?: boolean;
  /** Calendar day click → navigate to filtered Sessions list. */
  onPickDate?: (iso: string) => void;
  /** Opens a mini-game/Friendly Match detail view in the Games tab. */
  onOpenGame?: (gameId: string) => void;
}

type StatsView = "all" | "training" | "match";

export function StatsPanel({ calendarOnly = false, onPickDate, onOpenGame }: Props) {
  const [sessions] = useLocalStorage<Session[]>(STORAGE_KEYS.sessions, []);
  const [games] = useLocalStorage<CustomGame[]>(STORAGE_KEYS.customGames, []);
  const [players] = useLocalStorage<Player[]>(STORAGE_KEYS.players, []);
  const [view, setView] = useState<StatsView>("all");
  const [matchFormat, setMatchFormat] = useState<"all" | "singles" | "doubles">("all");
  const { visibility } = useSurfaceVisibility();
  
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  // ===== Calendar =====
  const monthInfo = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const last = new Date(cursor.y, cursor.m + 1, 0);
    const startWeekday = (first.getDay() + 6) % 7;
    const days = last.getDate();
    return { first, days, startWeekday };
  }, [cursor]);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const monthLabel = monthInfo.first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = new Date();

  type Cell = { day: number; surfaces: Surface[]; hasMatch: boolean; hasIC: boolean } | null;
  const cells: Cell[] = [];
  for (let i = 0; i < monthInfo.startWeekday; i++) cells.push(null);
  for (let d = 1; d <= monthInfo.days; d++) {
    const dayS = sessions.filter((s) => {
      const dt = new Date(s.date);
      return dt.getFullYear() === cursor.y && dt.getMonth() === cursor.m && dt.getDate() === d;
    });
    cells.push({
      day: d,
      surfaces: dayS.map((s) => s.surface),
      hasMatch: dayS.some((s) => s.mode === "match"),
      hasIC: dayS.some((s) => s.mode === "match" && s.isInterclub),
    });
  }

  const monthSelector = (
    <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-2 py-2">
      <button
        onClick={() => shiftMonth(-1)}
        className="size-9 rounded-full text-muted-foreground hover:text-foreground flex items-center justify-center"
        aria-label="Previous month"
      >
        <ChevronLeft className="size-5" />
      </button>
      <div className="text-base font-bold tabular-nums">{monthLabel}</div>
      <button
        onClick={() => shiftMonth(1)}
        className="size-9 rounded-full text-muted-foreground hover:text-foreground flex items-center justify-center"
        aria-label="Next month"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );

  const calendar = (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={i} className="aspect-square" />;
          const isToday =
            today.getFullYear() === cursor.y &&
            today.getMonth() === cursor.m &&
            today.getDate() === c.day;
          const sessionCount = c.surfaces.length;
          const primarySurface = c.surfaces[0];
          const sc = primarySurface ? surfaceClasses[primarySurface] : null;
          // 1 session → surface color, 2+ → neutral white/foreground
          const borderClass =
            sessionCount === 0
              ? "border-transparent"
              : sessionCount === 1 && sc
                ? sc.border
                : "border-foreground";
          const textClass =
            sessionCount === 0
              ? "text-muted-foreground/60"
              : sessionCount === 1 && sc
                ? `${sc.text} font-bold`
                : "text-foreground font-bold";
          const bgClass =
            sessionCount === 0
              ? ""
              : sessionCount === 1 && sc
                ? sc.bgSoft
                : "bg-foreground/5";
          return (
            <button
              type="button"
              key={i}
              onClick={() => {
                if (!onPickDate) return;
                const iso = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
                onPickDate(iso);
              }}
              disabled={!onPickDate || c.surfaces.length === 0}
              className={cn(
                "aspect-square rounded-lg flex items-center justify-center text-xs tabular-nums relative border-2 transition",
                borderClass,
                textClass,
                bgClass,
                isToday && "ring-1 ring-optic",
                onPickDate && c.surfaces.length > 0 && "hover:scale-105 cursor-pointer",
              )}
            >
              {c.day}
              {c.hasMatch && (
                <span
                  className="absolute -top-1 -right-1 size-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-black flex items-center justify-center leading-none"
                  aria-label="Official match"
                >
                  !
                </span>
              )}
              {c.hasIC && (
                <span
                  className="absolute -top-1 -left-1 px-1 h-3.5 min-w-[14px] rounded-full bg-[var(--ic-purple)] text-white text-[8px] font-black flex items-center justify-center leading-none tracking-wider"
                  aria-label="Interclub match"
                >
                  IC
                </span>
              )}
              {c.surfaces.length > 0 && (
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {c.surfaces.slice(0, 4).map((s, j) => (
                    <span
                      key={j}
                      className={cn("size-1 rounded-full", surfaceClasses[s].bg)}
                      aria-hidden
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-3 text-[10px] font-bold tracking-widest text-muted-foreground uppercase pt-1">
        {(["carpet", "clay", "hard"] as Surface[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", surfaceClasses[s].bg)} />
            {s}
          </div>
        ))}
      </div>
    </div>
  );

  // ===== Aggregates =====
  const data = useMemo(() => {
    const totalMin = sessions.reduce((a, s) => a + s.durationMin, 0);
    const totalSessions = sessions.length;
    const daysPlayed = new Set(sessions.map((s) => s.date)).size;
    const matches = sessions.filter((s) => s.mode === "match").length;

    // Hours per ISO week (last 8 weeks)
    const now = new Date();
    const weeks: { label: string; hours: number; month: number; year: number; monthShort: string }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ref = new Date(now);
      ref.setDate(now.getDate() - i * 7);
      const dow = (ref.getDay() + 6) % 7;
      const monday = new Date(ref);
      monday.setDate(ref.getDate() - dow);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const mIso = monday.toISOString().slice(0, 10);
      const sIso = sunday.toISOString().slice(0, 10);
      const hours = sessions
        .filter((s) => s.date >= mIso && s.date <= sIso)
        .reduce((a, s) => a + s.durationMin / 60, 0);
      weeks.push({
        label: monday.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        hours,
        month: monday.getMonth(),
        year: monday.getFullYear(),
        monthShort: monday.toLocaleDateString(undefined, { month: "short" }).slice(0, 3),
      });
    }

    // Win-rate vs rating
    const ratingStats: Record<OpponentRating, { w: number; l: number; d: number }> = {
      R1: { w: 0, l: 0, d: 0 }, R2: { w: 0, l: 0, d: 0 }, R3: { w: 0, l: 0, d: 0 },
      R4: { w: 0, l: 0, d: 0 }, R5: { w: 0, l: 0, d: 0 }, R6: { w: 0, l: 0, d: 0 },
      R7: { w: 0, l: 0, d: 0 }, R8: { w: 0, l: 0, d: 0 }, R9: { w: 0, l: 0, d: 0 },
    };
    for (const s of sessions) {
      if (s.mode !== "match" || !s.score?.rating) continue;
      const o = matchOutcome(s.score.sets);
      const r = s.score.rating;
      if (o.result === "win") ratingStats[r].w++;
      else if (o.result === "loss") ratingStats[r].l++;
      else ratingStats[r].d++;
    }

    const officialMatches = sessions.filter((s) => s.mode === "match" && s.score);
    let mW = 0, mL = 0;
    for (const s of officialMatches) {
      const o = matchOutcome(s.score!.sets);
      if (o.result === "win") mW++;
      else if (o.result === "loss") mL++;
    }
    const winRate = mW + mL > 0 ? Math.round((mW / (mW + mL)) * 100) : null;

    const bySurface: Record<Surface, number> = { carpet: 0, clay: 0, hard: 0 };
    for (const s of sessions) {
      if (s.mode === "match") bySurface[s.surface]++;
    }

    return {
      totalMin, totalSessions, daysPlayed, matches, weeks, ratingStats,
      mW, mL, winRate, bySurface, officialMatchesCount: officialMatches.length,
    };
  }, [sessions]);

  // Match-view data, filtered by Singles/Doubles toggle
  const matchData = useMemo(() => {
    const all = sessions.filter((s) => s.mode === "match" && s.score);
    const filtered = all.filter((s) => {
      if (matchFormat === "all") return true;
      return (s.formats ?? []).includes(matchFormat as Format);
    });
    let mW = 0, mL = 0;
    const ratingStats: Record<OpponentRating, { w: number; l: number; d: number }> = {
      R1: { w: 0, l: 0, d: 0 }, R2: { w: 0, l: 0, d: 0 }, R3: { w: 0, l: 0, d: 0 },
      R4: { w: 0, l: 0, d: 0 }, R5: { w: 0, l: 0, d: 0 }, R6: { w: 0, l: 0, d: 0 },
      R7: { w: 0, l: 0, d: 0 }, R8: { w: 0, l: 0, d: 0 }, R9: { w: 0, l: 0, d: 0 },
    };
    const bySurface: Record<Surface, number> = { carpet: 0, clay: 0, hard: 0 };
    let totalMin = 0;
    let longestMin = 0;
    const durations: number[] = [];
    for (const s of filtered) {
      const o = matchOutcome(s.score!.sets);
      if (o.result === "win") mW++;
      else if (o.result === "loss") mL++;
      if (s.score!.rating) {
        const r = s.score!.rating;
        if (o.result === "win") ratingStats[r].w++;
        else if (o.result === "loss") ratingStats[r].l++;
        else ratingStats[r].d++;
      }
      bySurface[s.surface]++;
      const d = s.durationMin || 0;
      totalMin += d;
      if (d > longestMin) longestMin = d;
      if (d > 0) durations.push(d);
    }
    const winRate = mW + mL > 0 ? Math.round((mW / (mW + mL)) * 100) : null;
    const avgMin = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    return {
      mW, mL, winRate, ratingStats, bySurface,
      officialMatchesCount: filtered.length,
      totalMin, longestMin, avgMin,
    };
  }, [sessions, matchFormat]);

  void games;
  void players;
  void onOpenGame;

  // Most Intensive Week — strict tiebreak logic
  const mostIntensiveWeek = useMemo(() => {
    if (sessions.length === 0) return null;
    const sorted = [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1));
    const minDate = sorted[0].date;
    const maxDate = sorted[sorted.length - 1].date;

    function rangeStats(startIso: string, days: number) {
      const start = new Date(startIso);
      const end = new Date(start);
      end.setDate(start.getDate() + days - 1);
      const startKey = start.toISOString().slice(0, 10);
      const endKey = end.toISOString().slice(0, 10);
      let totalMin = 0;
      let count = 0;
      for (const s of sessions) {
        if (s.date >= startKey && s.date <= endKey) {
          totalMin += s.durationMin;
          count++;
        }
      }
      return { startKey, endKey, totalMin, count, start, end };
    }

    // Iterate every 7-day window starting at each session date
    const candidates: { startKey: string; endKey: string; totalMin: number; count: number; start: Date; end: Date }[] = [];
    const seen = new Set<string>();
    for (const s of sessions) {
      if (seen.has(s.date)) continue;
      seen.add(s.date);
      candidates.push(rangeStats(s.date, 7));
    }
    if (candidates.length === 0) return null;

    // Tiebreak step 1: max hours
    const maxHours = Math.max(...candidates.map((c) => c.totalMin));
    let top = candidates.filter((c) => c.totalMin === maxHours);

    // Step 2: most sessions
    if (top.length > 1) {
      const maxCount = Math.max(...top.map((c) => c.count));
      top = top.filter((c) => c.count === maxCount);
    }
    // Step 3: expand to 9 days (one before, one after) and re-compare hours
    if (top.length > 1) {
      const expanded = top.map((c) => {
        const newStart = new Date(c.start);
        newStart.setDate(newStart.getDate() - 1);
        const stat = rangeStats(newStart.toISOString().slice(0, 10), 9);
        return { ...c, expandedHours: stat.totalMin };
      });
      const maxExp = Math.max(...expanded.map((c) => c.expandedHours));
      top = expanded.filter((c) => c.expandedHours === maxExp);
    }
    // Step 4: most recent
    if (top.length > 1) {
      top.sort((a, b) => (a.startKey < b.startKey ? 1 : -1));
      top = [top[0]];
    }
    void minDate; void maxDate;
    const winner = top[0];
    return {
      label: `${winner.start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${winner.end.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`,
      hours: winner.totalMin / 60,
      sessions: winner.count,
      startKey: winner.startKey,
      endKey: winner.endKey,
    };
  }, [sessions]);

  const maxWeekHours = Math.max(1, ...data.weeks.map((w) => w.hours));
  

  if (calendarOnly) {
    return (
      <section className="flex flex-col gap-3">
        {monthSelector}
        {calendar}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold">Stats</h2>
        <p className="text-sm text-muted-foreground mt-1">All-time performance overview.</p>
      </div>

      {/* 3-way toggle */}
      <div className="flex gap-2 p-1 bg-card border border-border rounded-full">
        {(["all", "training", "match"] as StatsView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "flex-1 px-4 py-2 rounded-full text-sm font-semibold transition-all capitalize",
              view === v ? "bg-optic text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "all" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Total Hours" value={formatDuration(data.totalMin)} />
            <Metric label="Sessions" value={String(data.totalSessions)} />
            <Metric label="Days Played" value={String(data.daysPlayed)} />
            <Metric label="Matches" value={String(data.matches)} />
          </div>
          <WeeklyVolume weeks={data.weeks} maxHours={maxWeekHours} title="Weekly Volume" />
          <MonthlyPerformance sessions={sessions} />
          <TimeOfDayHeatmap sessions={sessions} />
        </>
      )}

      {view === "training" && (
        <>
          <TrainingFormatBreakdown sessions={sessions} />

          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Most Intensive Week</div>
            {mostIntensiveWeek ? (
              <>
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-bold tabular-nums">{formatHours(mostIntensiveWeek.hours)}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {mostIntensiveWeek.label}
                  </div>
                </div>
                <IntensiveWeekStrip
                  startKey={mostIntensiveWeek.startKey}
                  sessions={sessions}
                />
                <div className="text-[11px] text-muted-foreground">
                  {mostIntensiveWeek.sessions} session{mostIntensiveWeek.sessions === 1 ? "" : "s"}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No data yet.</div>
            )}
          </div>

          <TimeOfDayHeatmap sessions={sessions} />
        </>
      )}

      {view === "match" && (
        <>
          {/* Singles / Doubles split */}
          <div className="flex gap-2 p-1 bg-card border border-border rounded-full">
            {(["all", "singles", "doubles"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setMatchFormat(v)}
                className={cn(
                  "flex-1 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                  matchFormat === v ? "bg-optic text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Official Matches</div>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Played" value={String(matchData.officialMatchesCount)} />
              <MiniStat label="W / L" value={`${matchData.mW}/${matchData.mL}`} accent="text-optic" />
              <MiniStat label="Win-Rate" value={matchData.winRate !== null ? `${matchData.winRate}%` : "—"} />
            </div>
            {matchData.winRate !== null && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-optic" style={{ width: `${matchData.winRate}%` }} />
                </div>
                <div className="text-sm font-bold tabular-nums w-12 text-right">{matchData.winRate}%</div>
              </div>
            )}
          </div>

          {/* Duration stats */}
          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Match Duration</div>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Total" value={formatDuration(matchData.totalMin)} />
              <MiniStat label="Longest" value={matchData.longestMin > 0 ? formatDuration(matchData.longestMin) : "—"} />
              <MiniStat label="Average" value={matchData.avgMin > 0 ? formatDuration(matchData.avgMin) : "—"} />
            </div>
          </div>

          <MatchNetTrend sessions={sessions.filter((s) => matchFormat === "all" || (s.formats ?? []).includes(matchFormat as Format))} />

          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Win-Rate vs Rating</div>
            <div className="flex flex-col gap-2">
              {OPPONENT_RATINGS.map((r) => {
                const s = matchData.ratingStats[r];
                const total = s.w + s.l + s.d;
                const wr = s.w + s.l > 0 ? Math.round((s.w / (s.w + s.l)) * 100) : null;
                return (
                  <div key={r} className="flex items-center gap-3">
                    <div className="w-9 text-xs font-bold tabular-nums">{r}</div>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      {wr !== null && <div className="h-full bg-optic" style={{ width: `${wr}%` }} />}
                    </div>
                    <div className="w-20 text-right text-[11px] tabular-nums text-muted-foreground">
                      {total === 0 ? "—" : `${wr}% · ${s.w}/${s.l}${s.d ? `/${s.d}` : ""}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Surface Distribution</div>
            <div className="flex flex-col gap-3">
              {(["carpet", "clay", "hard"] as Surface[])
                .filter((s) => visibility[s] !== false)
                .map((s) => {
                  const sc = surfaceClasses[s];
                  const count = matchData.bySurface[s];
                  const visibleMax = Math.max(
                    1,
                    ...(["carpet", "clay", "hard"] as Surface[])
                      .filter((x) => visibility[x] !== false)
                      .map((x) => matchData.bySurface[x]),
                  );
                  const pct = (count / visibleMax) * 100;
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <div className={cn("flex items-center gap-1.5 w-20 text-xs font-bold uppercase tracking-widest", sc.text)}>
                        <span className={cn("size-2 rounded-full", sc.dot)} />
                        {s}
                      </div>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", sc.bg)} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-8 text-right text-sm font-bold tabular-nums">{count}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function WeeklyVolume({ weeks, maxHours, title }: { weeks: { label: string; hours: number; month: number; year: number; monthShort: string }[]; maxHours: number; title: string }) {
  const safeMax = maxHours > 0 ? maxHours : 1;
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Last 8 weeks</div>
      </div>
      <div className="flex items-end gap-1.5 h-32">
        {weeks.map((w, i) => {
          const pct = safeMax > 0 ? (w.hours / safeMax) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex items-end h-full">
              <div
                className="w-full rounded-md bg-optic transition-all"
                style={{
                  height: `${pct}%`,
                  minHeight: w.hours > 0 ? 4 : 0,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        {weeks.map((w, i) => {
          const prev = i > 0 ? weeks[i - 1] : null;
          const isMonthStart = !prev || prev.month !== w.month || prev.year !== w.year;
          const showMonth = isMonthStart;
          const totalMin = Math.round(w.hours * 60);
          const h = Math.floor(totalMin / 60);
          const m = totalMin % 60;
          // Collision: if month label needs to show and minutes exist, round to whole hours
          const collide = showMonth && m > 0;
          const hourText = w.hours > 0
            ? (collide ? `${Math.round(w.hours)}h` : `${h}h`)
            : "0h";
          const minuteText = !collide && w.hours > 0 && m > 0 ? `${m}m` : "";
          return (
            <div key={i} className="flex-1 relative flex flex-col items-center">
              {isMonthStart && i > 0 && (
                <div className="absolute -left-0.5 top-0 h-3 w-px bg-border" />
              )}
              {/* Hour line — fixed height baseline */}
              <div className="h-3 flex items-start text-[9px] font-bold tabular-nums text-muted-foreground leading-none">
                {hourText}
              </div>
              {/* Second line: minutes OR month (collision rule prioritizes month) */}
              <div className="h-3 flex items-start text-[9px] font-bold tabular-nums text-muted-foreground leading-none">
                {showMonth ? (
                  <span className="uppercase tracking-wider">{w.monthShort}</span>
                ) : minuteText ? (
                  <span>{minuteText}</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-muted rounded-xl p-3 flex flex-col gap-0.5">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("text-base font-bold tabular-nums leading-tight", accent)}>{value}</div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-bold tabular-nums leading-none", accent)}>{value}</div>
    </div>
  );
}

function MonthlyPerformance({ sessions }: { sessions: Session[] }) {
  const months = useMemo(() => {
    const now = new Date();
    const out: { label: string; sessions: number; hours: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const inMonth = sessions.filter((s) => {
        const sd = new Date(s.date);
        return sd.getFullYear() === y && sd.getMonth() === m;
      });
      out.push({
        label: d.toLocaleDateString(undefined, { month: "short" }),
        sessions: inMonth.length,
        hours: inMonth.reduce((a, s) => a + s.durationMin / 60, 0),
      });
    }
    return out;
  }, [sessions]);

  const maxSessions = Math.max(1, ...months.map((m) => m.sessions));
  const maxHours = Math.max(1, ...months.map((m) => m.hours));

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Monthly Performance</div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          <div className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-optic" />Sessions</div>
          <div className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-foreground/60" />Hours</div>
        </div>
      </div>
      <div className="flex items-end gap-3 h-36">
        {months.map((m, i) => {
          const sPct = maxSessions > 0 ? (m.sessions / maxSessions) * 100 : 0;
          const hPct = maxHours > 0 ? (m.hours / maxHours) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0 h-full">
              <div className="w-full flex-1 flex items-end justify-center gap-1">
                <div className="w-1/2 flex flex-col items-center justify-end h-full">
                  <div className="text-[9px] font-bold tabular-nums text-muted-foreground leading-none mb-0.5">{m.sessions || ""}</div>
                  <div
                    className="w-full rounded-t-md bg-optic"
                    style={{ height: `${sPct}%`, minHeight: m.sessions > 0 ? 4 : 0 }}
                  />
                </div>
                <div className="w-1/2 flex flex-col items-center justify-end h-full">
                  <div className="text-[9px] font-bold tabular-nums text-muted-foreground leading-none mb-0.5">{m.hours > 0 ? formatHours(m.hours) : ""}</div>
                  <div
                    className="w-full rounded-t-md bg-foreground/60"
                    style={{ height: `${hPct}%`, minHeight: m.hours > 0 ? 4 : 0 }}
                  />
                </div>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{m.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IntensiveWeekStrip({ startKey, sessions }: { startKey: string; sessions: Session[] }) {
  const start = new Date(startKey);
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  // Re-anchor to Monday of that range to keep label alignment
  const dow = (start.getDay() + 6) % 7;
  const monday = new Date(start);
  monday.setDate(start.getDate() - dow);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const daySessions = sessions.filter((s) => s.date === iso);
    return {
      d,
      iso,
      surfaces: daySessions.map((s) => s.surface),
      hasMatch: daySessions.some((s) => s.mode === "match"),
    };
  });
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((day, i) => {
        const sessionCount = day.surfaces.length;
        const primary = day.surfaces[0];
        const sc = primary ? surfaceClasses[primary] : null;
        const borderClass =
          sessionCount === 0
            ? "border-border/60"
            : sessionCount === 1 && sc
              ? sc.border
              : "border-foreground";
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "aspect-square w-full rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 relative",
                borderClass,
                sessionCount > 0 && "bg-foreground/5",
              )}
            >
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground leading-none">
                {labels[i]}
              </div>
              <div className="text-sm font-bold tabular-nums leading-none">{day.d.getDate()}</div>
              {day.hasMatch && (
                <span
                  className="absolute -top-1 -right-1 size-3.5 rounded-full bg-destructive text-destructive-foreground text-[8px] font-black flex items-center justify-center leading-none"
                  aria-label="Match"
                >
                  !
                </span>
              )}
            </div>
            <div className="h-1.5 flex items-center justify-center gap-0.5">
              {day.surfaces.slice(0, 3).map((s, j) => (
                <span key={j} className={cn("size-1 rounded-full", surfaceClasses[s].bg)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}


/**
 * Match view: net match result per session as a step line chart.
 * Net = +1 for win, -1 for loss, 0 for draw. Cumulative? No: per-session net,
 * showing momentum. Last 12 official matches (chronological).
 */
function MatchNetTrend({ sessions }: { sessions: Session[] }) {
  const [open, setOpen] = useState(false);
  const points = useMemo(() => {
    const matches = sessions
      .filter((s) => s.mode === "match" && s.score)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    return matches
      .map((s) => {
        const o = matchOutcome(s.score!.sets);
        const net = o.result === "win" ? 1 : o.result === "loss" ? -1 : 0;
        return { label: s.date.slice(5), net };
      })
      .slice(-12);
  }, [sessions]);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-3 flex items-center justify-between gap-3"
        aria-expanded={open}
      >
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Net per Match
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border p-3 animate-fade-in">
          {points.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No official matches yet.</div>
          ) : (
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeOpacity={0.25} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[-1, 1]}
                    ticks={[-1, 0, 1]}
                    tickFormatter={(v) => (v === 1 ? "W" : v === -1 ? "L" : "D")}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={26}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                    formatter={(v: number) => [v === 1 ? "Win" : v === -1 ? "Loss" : "Draw", "Result"]}
                  />
                  <ReferenceLine y={0} stroke="var(--border)" strokeOpacity={0.6} />
                  <Line
                    type="linear"
                    dataKey="net"
                    stroke="var(--optic)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Training view: stacked horizontal bar of training session counts split by
 * format (Singles / Doubles / Casual). A session can carry multiple formats
 * (they are checkboxes in the form), so we sum each independently.
 */
function TrainingFormatBreakdown({ sessions }: { sessions: Session[] }) {
  const counts = useMemo(() => {
    let singles = 0, doubles = 0, casual = 0;
    for (const s of sessions) {
      if (s.mode !== "training") continue;
      if (s.formats?.includes("singles")) singles++;
      if (s.formats?.includes("doubles")) doubles++;
      if (s.formats?.includes("casual")) casual++;
    }
    return { singles, doubles, casual };
  }, [sessions]);

  const total = counts.singles + counts.doubles + counts.casual;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Training Format</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground tabular-nums">{total} session{total === 1 ? "" : "s"}</div>
      </div>
      {total === 0 ? (
        <div className="text-sm text-muted-foreground py-2">No training sessions yet.</div>
      ) : (
        <>
          <div className="flex h-4 rounded-full overflow-hidden bg-muted">
            {counts.singles > 0 && (
              <div
                className="bg-foreground/85 transition-all"
                style={{ width: `${(counts.singles / total) * 100}%` }}
                title={`Singles: ${counts.singles}`}
              />
            )}
            {counts.doubles > 0 && (
              <div
                className="bg-foreground/55 transition-all"
                style={{ width: `${(counts.doubles / total) * 100}%` }}
                title={`Doubles: ${counts.doubles}`}
              />
            )}
            {counts.casual > 0 && (
              <div
                className="bg-foreground/25 transition-all"
                style={{ width: `${(counts.casual / total) * 100}%` }}
                title={`Casual: ${counts.casual}`}
              />
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <FormatLegend dotClass="bg-foreground/85" label="Singles" count={counts.singles} total={total} />
            <FormatLegend dotClass="bg-foreground/55" label="Doubles" count={counts.doubles} total={total} />
            <FormatLegend dotClass="bg-foreground/25" label="Casual" count={counts.casual} total={total} />
          </div>
        </>
      )}
    </div>
  );
}

function FormatLegend({ dotClass, label, count, total }: { dotClass: string; label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={cn("size-2 rounded-full shrink-0", dotClass)} />
        <span className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground truncate">{label}</span>
      </div>
      <div className="text-sm font-bold tabular-nums">{count} <span className="text-[10px] text-muted-foreground font-medium">· {pct}%</span></div>
    </div>
  );
}

/**
 * Time-of-Day distribution heatmap. Each hour 0-23 is a cell whose intensity
 * scales with the count of sessions whose `startTime` falls in that hour.
 * Sessions without a startTime are excluded from the count (and surfaced in a
 * footer note).
 */
function TimeOfDayHeatmap({ sessions }: { sessions: Session[] }) {
  const { hours, missing, peak } = useMemo(() => {
    // Distribute each session's duration across the hour buckets it spans.
    // E.g. 120 min starting 18:00 → 60 min into bucket 18, 60 min into bucket 19.
    const buckets = new Array(24).fill(0) as number[];
    let missing = 0;
    for (const s of sessions) {
      if (!s.startTime) { missing++; continue; }
      const [hStr, mStr] = s.startTime.split(":");
      const startH = Number(hStr);
      const startM = Number(mStr ?? "0");
      const dur = Math.max(0, Number(s.durationMin) || 0);
      if (!Number.isFinite(startH) || startH < 0 || startH > 23 || dur <= 0) continue;
      let cursorMinutes = startH * 60 + (Number.isFinite(startM) ? startM : 0);
      let remaining = dur;
      while (remaining > 0) {
        const hour = Math.floor(cursorMinutes / 60) % 24;
        const minutesUntilNextHour = 60 - (cursorMinutes % 60);
        const slice = Math.min(remaining, minutesUntilNextHour);
        buckets[hour] += slice;
        cursorMinutes += slice;
        remaining -= slice;
      }
    }
    const peak = Math.max(...buckets);
    return { hours: buckets, missing, peak };
  }, [sessions]);

  const peakHour = peak > 0 ? hours.indexOf(peak) : null;

  const visibleHours = hours.slice(7, 23); // 07h..22h inclusive (16 cells)
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Activity Heatmap</div>
        {peakHour !== null && (
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground tabular-nums">
            Peak {String(peakHour).padStart(2, "0")}:00
          </div>
        )}
      </div>
      <div className="grid grid-cols-8 gap-1.5">
        {visibleHours.map((minutes, idx) => {
          const h = idx + 7;
          const intensity = peak > 0 ? minutes / peak : 0;
          let bg = "bg-muted";
          if (minutes > 0) {
            if (intensity > 0.93) bg = "bg-optic";
            else if (intensity > 0.86) bg = "bg-optic/95";
            else if (intensity > 0.78) bg = "bg-optic/90";
            else if (intensity > 0.70) bg = "bg-optic/80";
            else if (intensity > 0.62) bg = "bg-optic/70";
            else if (intensity > 0.54) bg = "bg-optic/60";
            else if (intensity > 0.46) bg = "bg-optic/50";
            else if (intensity > 0.38) bg = "bg-optic/40";
            else if (intensity > 0.30) bg = "bg-optic/35";
            else if (intensity > 0.22) bg = "bg-optic/28";
            else if (intensity > 0.15) bg = "bg-optic/22";
            else if (intensity > 0.08) bg = "bg-optic/16";
            else bg = "bg-optic/10";
          }
          const totalH = Math.floor(minutes / 60);
          const totalM = Math.round(minutes % 60);
          const tip = minutes > 0
            ? `${String(h).padStart(2, "0")}:00 — ${totalH > 0 ? `${totalH}h ` : ""}${totalM}m`
            : `${String(h).padStart(2, "0")}:00 — 0m`;
          const isBright = intensity > 0.5;
          return (
            <div
              key={h}
              className={cn(
                "aspect-square rounded-full border border-transparent flex items-center justify-center",
                bg,
                peakHour === h && "ring-2 ring-foreground",
              )}
              title={tip}
            >
              <span
                className={cn(
                  "text-[10px] font-bold tabular-nums leading-none select-none",
                  isBright ? "text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {h}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-widest text-muted-foreground">
        <span>07h → 22h</span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          <span className="size-2 rounded-full bg-optic/15" />
          <span className="size-2 rounded-full bg-optic/30" />
          <span className="size-2 rounded-full bg-optic/50" />
          <span className="size-2 rounded-full bg-optic/70" />
          <span className="size-2 rounded-full bg-optic/90" />
          <span className="size-2 rounded-full bg-optic" />
          <span>More</span>
        </div>
      </div>
      {missing > 0 && (
        <div className="text-[10px] text-muted-foreground">
          {missing} session{missing === 1 ? "" : "s"} without start time excluded.
        </div>
      )}
    </div>
  );
}



