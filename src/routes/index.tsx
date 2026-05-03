import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useLocalStorage, STORAGE_KEYS } from "@/lib/storage";
import type { CustomGame, Session } from "@/lib/types";
import { SessionForm } from "@/components/SessionForm";
import { SessionsList } from "@/components/SessionsList";
import { CustomGamesPanel } from "@/components/CustomGamesPanel";
import { NetworkPanel } from "@/components/NetworkPanel";
import { StatsPanel } from "@/components/StatsPanel";
import { cn } from "@/lib/utils";
import {
  Plus,
  LayoutDashboard,
  Calendar,
  Trophy,
  Users,
  BarChart3,
  MapPin,
  Settings as SettingsIcon,
  Home as HomeIcon,
  ChevronDown,
  Clock,
} from "lucide-react";
import { matchOutcome, surfaceClasses, formatDuration, formatStartTime } from "@/lib/surface";
import { sessionTitle } from "@/lib/sessionTitle";
import { SettingsPanel } from "@/components/SettingsPanel";
import { withFriendlyResults, withFriendlyGame } from "@/lib/friendly";
import { formatDayShort, formatDayLong } from "@/lib/dates";
import { useUserName, useUserRating } from "@/lib/identity";

export const Route = createFileRoute("/")({
  component: Index,
});

type Tab = "dashboard" | "sessions" | "stats" | "trackers" | "network";

const TABS: { id: Tab; label: string; Icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Home", Icon: LayoutDashboard },
  { id: "sessions", label: "Sessions", Icon: Calendar },
  { id: "stats", label: "Stats", Icon: BarChart3 },
  { id: "trackers", label: "Games", Icon: Trophy },
  { id: "network", label: "Network", Icon: Users },
];

function Index() {
  const [sessions] = useLocalStorage<Session[]>(STORAGE_KEYS.sessions, []);
  const [games] = useLocalStorage<CustomGame[]>(STORAGE_KEYS.customGames, []);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [trackersFilterPlayerId, setTrackersFilterPlayerId] = useState<string | null>(null);
  const [trackersInitialGameId, setTrackersInitialGameId] = useState<string | null>(null);
  const [sessionsDateFilter, setSessionsDateFilter] = useState<string | null>(null);
  const networkLeaveGuardRef = useRef<(() => boolean) | null>(null);
  const gameOriginTabRef = useRef<Tab | null>(null);

  function trySetTab(next: Tab) {
    if (tab === "network" && next !== "network" && networkLeaveGuardRef.current) {
      const blocked = networkLeaveGuardRef.current();
      if (blocked) return;
    }
    setTab(next);
  }

  function openGame(gameId: string) {
    gameOriginTabRef.current = tab;
    setTrackersInitialGameId(gameId);
    trySetTab("trackers");
  }

  function handleGameDetailBack() {
    const origin = gameOriginTabRef.current;
    gameOriginTabRef.current = null;
    setTrackersInitialGameId(null);
    if (origin && origin !== "trackers") {
      trySetTab(origin);
    }
  }

  const dashboard = useMemo(() => {
    // Project Friendly Match results (training-with-score) into the customResults
    // stream + virtual game so standings include them automatically.
    const mergedSessions = withFriendlyResults(sessions);
    const mergedGames = withFriendlyGame(games);

    const total = sessions.length;
    const totalMin = sessions.reduce((a, s) => a + s.durationMin, 0);
    const daysPlayed = new Set(sessions.map((s) => s.date)).size;

    const sorted = [...sessions].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
    );
    const last = sorted[0] ?? null;

    const matchResults: ("win" | "loss" | "draw")[] = [];
    for (const s of sorted) {
      if (s.mode !== "match" || !s.score) continue;
      matchResults.push(matchOutcome(s.score.sets).result);
      if (matchResults.length >= 5) break;
    }

    // Iterate games in the same order used on the Games page (manual `order`,
    // falling back to creation time newest-first for legacy items).
    const orderedGames = [...mergedGames].sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
    const standings: { id: string; name: string; w: number; l: number; d: number }[] = [];
    for (const g of orderedGames) {
      let w = 0, l = 0, d = 0;
      for (const s of mergedSessions) {
        for (const r of s.customResults ?? []) {
          if (r.gameId !== g.id) continue;
          const o = matchOutcome(r.sets);
          if (o.result === "win") w++;
          else if (o.result === "loss") l++;
          else d++;
        }
      }
      if (w + l + d > 0) standings.push({ id: g.id, name: g.name, w, l, d });
    }

    return { total, totalMin, daysPlayed, last, matchResults, standings };
  }, [sessions, games]);

  function openTrackersForPlayer(playerId: string) {
    setTrackersFilterPlayerId(playerId);
    trySetTab("trackers");
  }

  function openSessionsForDate(iso: string) {
    setSessionsDateFilter(iso);
    trySetTab("sessions");
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur border-b border-border">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3 safe-pt">
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <div className="size-10 rounded-2xl bg-optic flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="size-5 text-primary-foreground" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12c4 0 7-3 9-9M21 12c-4 0-7 3-9 9" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-none truncate">Baseline</h1>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1 truncate">
                Tennis Tracker
              </div>
            </div>
          </div>
          <div className="flex-1 flex justify-center min-w-0 px-2">
            <UserIdentityChip />
          </div>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="size-10 rounded-full bg-card border border-border flex items-center justify-center hover:border-foreground/40 transition shrink-0"
            aria-label={showSettings ? "Back to home" : "Open settings"}
          >
            {showSettings ? (
              <HomeIcon className="size-5 text-muted-foreground" />
            ) : (
              <SettingsIcon className="size-5 text-muted-foreground" />
            )}
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-5 pb-36 flex flex-col gap-5">
        {showSettings ? (
          <SettingsPanel onClose={() => setShowSettings(false)} />
        ) : showForm ? (
          <SessionForm onSaved={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
        ) : (
          <>
            {tab === "dashboard" && (
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Hours" value={formatDuration(dashboard.totalMin)} />
                  <Stat label="Sessions" value={String(dashboard.total)} />
                  <Stat label="Days" value={String(dashboard.daysPlayed)} />
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground -mb-2 pl-1">
                  Your Year · All-Time Stats
                </div>
                <SevenDayStrip sessions={sessions} />
                <LastSessionWidget session={dashboard.last} />
                <CurrentForm results={dashboard.matchResults} />
                <CustomGameStandingsCard standings={dashboard.standings} onOpenGame={openGame} />
              </div>
            )}
            {tab === "sessions" && (
              <div className="flex flex-col gap-5">
                <StatsPanel calendarOnly onPickDate={openSessionsForDate} />
                <CollapsibleSessions
                  initialDateFilter={sessionsDateFilter}
                  onClearDateFilter={() => setSessionsDateFilter(null)}
                  forceOpen={!!sessionsDateFilter}
                />
              </div>
            )}
            {tab === "stats" && <StatsPanel onOpenGame={openGame} />}
            {tab === "trackers" && (
              <CustomGamesPanel
                initialPartnerId={trackersFilterPlayerId}
                initialGameId={trackersInitialGameId}
                onClearFilter={() => setTrackersFilterPlayerId(null)}
                onClearGameId={() => setTrackersInitialGameId(null)}
                onGameDetailBack={handleGameDetailBack}
              />
            )}
            {tab === "network" && (
              <NetworkPanel
                onOpenGamesForPlayer={openTrackersForPlayer}
                registerLeaveGuard={(g) => { networkLeaveGuardRef.current = g; }}
              />
            )}
          </>
        )}
      </div>

      {!showForm && !showSettings && (
        <div className="fixed bottom-20 inset-x-0 z-30 pointer-events-none safe-pb">
          <div className="max-w-md mx-auto px-4 flex justify-end">
            <button
              onClick={() => setShowForm(true)}
              className="pointer-events-auto size-14 rounded-full bg-optic text-primary-foreground flex items-center justify-center hover:brightness-110 transition"
              aria-label="New session"
            >
              <Plus className="size-6" />
            </button>
          </div>
        </div>
      )}

      {!showForm && !showSettings && (
        <nav className="fixed bottom-0 inset-x-0 z-20 bg-card/95 backdrop-blur border-t border-border">
          <div className="max-w-md mx-auto grid grid-cols-5">
            {TABS.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => trySetTab(id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-3 transition-colors",
                    active ? "text-optic" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
                </button>
              );
            })}
          </div>
          <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
        </nav>
      )}
    </div>
  );
}

function UserIdentityChip() {
  const [rating] = useUserRating();
  if (!rating) return null;
  
  return (
    <div className="flex items-center justify-center min-w-[48px] px-3 py-1.5 rounded-full bg-card border border-border">
      <span className="text-[11px] font-bold tabular-nums leading-none text-optic">
        {rating}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3 flex flex-col gap-0.5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums leading-tight">{value}</div>
    </div>
  );
}

function SevenDayStrip({ sessions }: { sessions: Session[] }) {
  const today = new Date();
  const todayDow = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - todayDow);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const daySessions = sessions.filter((s) => s.date === iso);
    return {
      date: d,
      iso,
      isToday: iso === today.toISOString().slice(0, 10),
      surfaces: daySessions.map((s) => s.surface),
      hasMatch: daySessions.some((s) => s.mode === "match"),
    };
  });

  const labels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">This Week</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {formatDayShort(monday)}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const sessionCount = d.surfaces.length;
          const primary = d.surfaces[0];
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
                  d.isToday && "bg-optic/10 ring-1 ring-optic",
                )}
              >
                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground leading-none">
                  {labels[i]}
                </div>
                <div className={cn("text-base font-bold tabular-nums leading-none", d.isToday && "text-optic")}>
                  {d.date.getDate()}
                </div>
                {d.hasMatch && (
                  <span
                    className="absolute -top-1 -right-1 size-3.5 rounded-full bg-destructive text-destructive-foreground text-[8px] font-black flex items-center justify-center leading-none"
                    aria-label="Match"
                  >
                    !
                  </span>
                )}
              </div>
              <div className="h-1.5 flex items-center justify-center gap-0.5">
                {d.surfaces.slice(0, 3).map((s, j) => (
                  <span key={j} className={cn("size-1 rounded-full", surfaceClasses[s].bg)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoldScoreRow({ sets }: { sets: { me: number | null; opp: number | null; meTb?: number | null; oppTb?: number | null; isCtb?: boolean }[] }) {
  return (
    <div className="flex gap-1.5 tabular-nums">
      {sets.map((set, i) => {
        const meWin = set.me != null && set.opp != null && set.me > set.opp;
        const oppWin = set.me != null && set.opp != null && set.opp > set.me;
        const isTb =
          !set.isCtb &&
          ((set.me === 7 && set.opp === 6) || (set.me === 6 && set.opp === 7));
        return (
          <div key={i} className="flex flex-col items-center leading-none gap-0.5">
            <span className={cn("min-w-[30px] text-center px-2 py-1 rounded-md font-display font-black text-3xl", meWin ? "bg-graphite text-foreground" : "text-muted-foreground")}>
              {set.me ?? "-"}
              {isTb && set.meTb != null && (
                <sup className="ml-0.5 text-[11px] font-bold text-optic">{set.meTb}</sup>
              )}
            </span>
            <span className={cn("min-w-[30px] text-center px-2 py-1 rounded-md font-display font-black text-3xl", oppWin ? "bg-graphite text-foreground" : "text-muted-foreground")}>
              {set.opp ?? "-"}
              {isTb && set.oppTb != null && (
                <sup className="ml-0.5 text-[11px] font-bold text-optic">{set.oppTb}</sup>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LastSessionWidget({ session }: { session: Session | null }) {
  if (!session) {
    return (
      <div className="bg-card border border-dashed border-border rounded-2xl p-6 text-center">
        <div className="text-sm font-semibold">No sessions yet</div>
        <div className="text-xs text-muted-foreground mt-1">Tap + to log your first one.</div>
      </div>
    );
  }
  const sc = surfaceClasses[session.surface];
  const score = session.score;
  const o = score ? matchOutcome(score.sets) : null;
  const isMatch = session.mode === "match";
  const title = sessionTitle(session);
  return (
    <div className="relative bg-card border border-border rounded-2xl overflow-hidden">
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          {/* LEFT: label + title + chips */}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Last Session</div>
            <div className="text-base font-bold leading-snug truncate">{title}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest", sc.text)}>
                <span className={cn("size-1.5 rounded-full", sc.dot)} />
                {session.surface}
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
                  isMatch ? "bg-optic text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                {isMatch ? "Match" : session.isFriendly ? "Friendly" : "Training"}
              </span>
              {session.isInterclub && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white bg-[var(--ic-purple)]">
                  IC
                </span>
              )}
            </div>
          </div>

          {/* RIGHT: result badge + score, both anchored top-right */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {o && (
              <div
                className={cn(
                  "px-3.5 py-1 rounded-full font-black text-[11px] tracking-[0.2em] flex items-center justify-center",
                  o.result === "win" && "bg-success text-success-foreground",
                  o.result === "loss" && "bg-destructive text-destructive-foreground",
                  o.result === "draw" && "bg-white text-black",
                )}
              >
                {o.result === "win" ? "WIN" : o.result === "loss" ? "LOSS" : "DRAW"}
              </div>
            )}
            {score && <BoldScoreRow sets={score.sets} />}
          </div>
        </div>

        {/* Meta row: date · time · duration · location */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums flex-wrap">
          <span className="flex items-center gap-1.5">
            <Clock className="size-3" />
            <span className="truncate">
              {formatDayLong(session.date)}
              {session.startTime ? ` · ${formatStartTime(session.startTime)}` : ""}
              {` · ${formatDuration(session.durationMin)}`}
            </span>
          </span>
          {session.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              <span className="truncate">{session.location}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CurrentForm({ results }: { results: ("win" | "loss" | "draw")[] }) {
  const slots = Array.from({ length: 5 }, (_, i) => results[i] ?? null);
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Current Form</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Last 5 matches</div>
      </div>
      <div className="flex items-center justify-center gap-2.5">
        {slots.map((r, i) => (
          <div
            key={i}
            className={cn(
              "size-9 rounded-full border-2 flex items-center justify-center text-xs font-black tabular-nums",
              r === "win" && "bg-success text-success-foreground border-success",
              r === "loss" && "bg-destructive text-destructive-foreground border-destructive",
              r === "draw" && "bg-muted text-muted-foreground border-border",
              r == null && "bg-transparent text-muted-foreground/40 border-dashed border-border",
            )}
          >
            {r === "win" ? "W" : r === "loss" ? "L" : r === "draw" ? "D" : "—"}
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomGameStandingsCard({
  standings,
  onOpenGame,
}: {
  standings: { id: string; name: string; w: number; l: number; d: number }[];
  onOpenGame?: (id: string) => void;
}) {
  if (standings.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Custom Game Standings</div>
      <div className="flex flex-col gap-1.5">
        {standings.map((g) => (
          <button
            type="button"
            key={g.id}
            onClick={() => onOpenGame?.(g.id)}
            disabled={!onOpenGame}
            className="flex items-center justify-between py-1 text-left hover:text-optic transition disabled:cursor-default"
          >
            <div className="font-medium truncate">{g.name}</div>
            <div className="flex items-center gap-3 text-sm tabular-nums font-semibold">
              <span className="text-success">{g.w}W</span>
              <span className="text-destructive">{g.l}L</span>
              <span className="text-muted-foreground">{g.d}D</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CollapsibleSessions({
  initialDateFilter,
  onClearDateFilter,
  forceOpen,
}: {
  initialDateFilter: string | null;
  onClearDateFilter: () => void;
  forceOpen: boolean;
}) {
  const [open, setOpen] = useState(forceOpen);
  // Auto-open when a date filter arrives
  if (forceOpen && !open) setOpen(true);
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between"
      >
        <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Show All Sessions</span>
        <ChevronDown className={cn("size-5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-3 pb-4 border-t border-border pt-4">
          <SessionsList
            initialDateFilter={initialDateFilter}
            onClearDateFilter={onClearDateFilter}
          />
        </div>
      )}
    </div>
  );
}
