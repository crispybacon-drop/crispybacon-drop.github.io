import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage, STORAGE_KEYS } from "@/lib/storage";
import type { CustomGame, Player, Session, Format, SessionMode } from "@/lib/types";
import { surfaceClasses, formatDuration, matchOutcome, formatStartTime } from "@/lib/surface";
import { sessionTitle } from "@/lib/sessionTitle";
import { cn } from "@/lib/utils";
import { MoreVertical, X, Search, LayoutGrid, List, Clock, MapPin, Pencil, Trash2 } from "lucide-react";
import { SessionForm } from "./SessionForm";
import { AnimatedTabs } from "./AnimatedTabs";
import { useSurfaceVisibility } from "@/lib/visibleSurfaces";
import { useDefaultSessionsView } from "@/lib/settings";
import { useMeLabel } from "@/lib/identity";

type LayoutMode = "list" | "grid";
type ModeFilter = "all" | "match" | "training";
type FormatFilter = "all" | "singles" | "doubles";

interface Props {
  /** Pre-filter the list (used by Calendar deep-link). */
  initialDateFilter?: string | null;
  onClearDateFilter?: () => void;
}

export function SessionsList({ initialDateFilter = null, onClearDateFilter }: Props) {
  const [sessions, setSessions] = useLocalStorage<Session[]>(STORAGE_KEYS.sessions, []);
  const [games] = useLocalStorage<CustomGame[]>(STORAGE_KEYS.customGames, []);
  const [players] = useLocalStorage<Player[]>(STORAGE_KEYS.players, []);
  const [editing, setEditing] = useState<Session | null>(null);
  const savedScrollY = useRef<number | null>(null);
  function startEdit(s: Session) {
    savedScrollY.current = typeof window !== "undefined" ? window.scrollY : 0;
    setEditing(s);
  }
  function exitEdit() {
    setEditing(null);
    const y = savedScrollY.current;
    if (y != null && typeof window !== "undefined") {
      // Wait for list re-render before restoring.
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "auto" });
      });
    }
  }
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [defaultView] = useDefaultSessionsView();
  const [layout, setLayout] = useState<LayoutMode>(defaultView);
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [dateFilter, setDateFilter] = useState<string | null>(initialDateFilter);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  useEffect(() => {
    setDateFilter(initialDateFilter);
  }, [initialDateFilter]);

  function remove(id: string) {
    setSessions(sessions.filter((s) => s.id !== id));
    setConfirmId(null);
  }

  function togglePlayer(id: string) {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const visiblePlayers = useMemo(
    () => players.filter((p) => !p.isArchived),
    [players],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions
      .filter((s) => {
        if (dateFilter && s.date !== dateFilter) return false;
        if (modeFilter === "match" && s.mode !== ("match" as SessionMode)) return false;
        if (modeFilter === "training" && s.mode !== "training") return false;
        if (formatFilter === "singles" && !(s.formats ?? []).includes("singles" as Format)) return false;
        if (formatFilter === "doubles" && !(s.formats ?? []).includes("doubles" as Format)) return false;
        if (selectedPlayerIds.length > 0) {
          const playerNames = selectedPlayerIds
            .map((id) => players.find((p) => p.id === id)?.name?.toLowerCase())
            .filter(Boolean) as string[];
          const matchesAny = selectedPlayerIds.some((pid) => {
            const pname = players.find((p) => p.id === pid)?.name?.toLowerCase();
            if (!pname) return false;
            if (s.score?.opponentId === pid) return true;
            if (s.score?.partnerId === pid) return true;
            if (s.score?.opponent?.toLowerCase() === pname) return true;
            if (s.score?.partnerName?.toLowerCase() === pname) return true;
            if (
              s.customResults?.some(
                (r) =>
                  r.partnerId === pid ||
                  (r.partnerName && r.partnerName.toLowerCase() === pname),
              )
            ) {
              return true;
            }
            return false;
          });
          void playerNames;
          if (!matchesAny) return false;
        }
        if (q) {
          const haystack = [
            s.location ?? "",
            s.score?.opponent ?? "",
            s.score?.partnerName ?? "",
            s.score?.opponentsLabel ?? "",
            s.notes ?? "",
            s.surface,
            s.mode,
            sessionTitle(s),
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [sessions, modeFilter, formatFilter, query, dateFilter, selectedPlayerIds, players]);

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Edit Session</h2>
          <button
            onClick={exitEdit}
            className="size-10 rounded-full bg-card border border-border flex items-center justify-center hover:border-foreground/40"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <SessionForm
          editing={editing}
          onSaved={exitEdit}
          onCancel={exitEdit}
        />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
        <div className="text-lg font-bold">No sessions yet</div>
        <div className="text-sm text-muted-foreground mt-1">Tap + to log your first session.</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Date filter chip (from Calendar deep-link) */}
        {dateFilter && (
          <div className="bg-optic/10 border-2 border-optic rounded-2xl p-3 flex items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Filtered by date:</span>{" "}
              <span className="font-bold text-optic tabular-nums">
                {new Date(dateFilter).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            <button
              onClick={() => {
                setDateFilter(null);
                onClearDateFilter?.();
              }}
              className="size-8 rounded-full bg-card border border-border flex items-center justify-center"
              aria-label="Clear date filter"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Toolbar: search + layout toggle */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full bg-background border-2 border-border rounded-xl pl-9 pr-3 py-2.5 text-sm font-medium focus:outline-none focus:border-optic placeholder:text-muted-foreground/70"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-7 rounded-full text-muted-foreground hover:text-foreground flex items-center justify-center"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="flex bg-card border-2 border-border rounded-xl p-0.5">
            <button
              onClick={() => setLayout("grid")}
              className={cn(
                "size-10 rounded-lg flex items-center justify-center transition",
                layout === "grid" ? "bg-optic text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Grid view"
              aria-pressed={layout === "grid"}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setLayout("list")}
              className={cn(
                "size-10 rounded-lg flex items-center justify-center transition",
                layout === "list" ? "bg-optic text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="List view"
              aria-pressed={layout === "list"}
            >
              <List className="size-4" />
            </button>
          </div>
        </div>

        {/* Filter pills — two distinct groups */}
        <div className="flex flex-col gap-2">
          <AnimatedTabs
            value={modeFilter}
            onChange={(v) => setModeFilter(v as ModeFilter)}
            size="sm"
            tabs={[
              { id: "all", label: "All" },
              { id: "match", label: "Match" },
              { id: "training", label: "Training" },
            ]}
          />
          <AnimatedTabs
            value={formatFilter}
            onChange={(v) => setFormatFilter(v as FormatFilter)}
            size="sm"
            tabs={[
              { id: "all", label: "All" },
              { id: "singles", label: "Singles" },
              { id: "doubles", label: "Doubles" },
            ]}
          />
        </div>

        {/* Multi-player filter chips */}
        {visiblePlayers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {visiblePlayers.map((p) => {
              const active = selectedPlayerIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlayer(p.id)}
                  className={cn(
                    "px-3 py-1 rounded-full border-2 text-[11px] font-bold uppercase tracking-wider transition",
                    active
                      ? "border-optic bg-optic/15 text-optic"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={active}
                >
                  {p.name}
                </button>
              );
            })}
            {selectedPlayerIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedPlayerIds([])}
                className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
            No sessions match your filters.
          </div>
        ) : (
          <div className={cn(layout === "grid" ? "grid grid-cols-2 gap-2.5" : "flex flex-col gap-2")}>
            {filtered.map((s) => (
              <SessionCard
                key={s.id}
                s={s}
                games={games}
                compact={layout === "grid"}
                onEdit={() => startEdit(s)}
                onDelete={() => setConfirmId(s.id)}
              />
            ))}
          </div>
        )}
      </div>

      {confirmId && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setConfirmId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 flex flex-col gap-4"
          >
            <div>
              <div className="text-lg font-bold">Delete this session?</div>
              <div className="text-sm text-muted-foreground mt-1">
                This will remove the session and any attached mini-game results. Stats will recalculate.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 py-3 rounded-2xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => remove(confirmId)}
                className="flex-1 py-3 rounded-2xl bg-destructive text-destructive-foreground text-sm font-bold hover:brightness-110"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MetaLine({ s, compact = false }: { s: Session; compact?: boolean }) {
  const d = new Date(s.date);
  const dateLabel = compact
    ? `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(-2)}`
    : d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
  const timePart = compact ? "" : (s.startTime ? ` · ${formatStartTime(s.startTime)}` : "");
  const durationPart = compact ? "" : (s.durationMin > 0 ? ` · ${formatDuration(s.durationMin)}` : "");
  return (
    <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground tabular-nums min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <Clock className="size-3 shrink-0" />
        <span className="truncate">
          {dateLabel}
          {timePart}
          {durationPart}
        </span>
      </div>
      {s.location && (
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{s.location}</span>
        </div>
      )}
    </div>
  );
}

function ResultBadge({ result }: { result: "win" | "loss" | "draw" }) {
  const label = result === "win" ? "WIN" : result === "loss" ? "LOSS" : "DRAW";
  return (
    <div
      className={cn(
        "px-3 py-1 rounded-full font-black text-[10px] tracking-[0.2em] flex items-center justify-center shrink-0",
        result === "win" && "bg-success text-success-foreground",
        result === "loss" && "bg-destructive text-destructive-foreground",
        result === "draw" && "bg-white text-black",
      )}
    >
      {label}
    </div>
  );
}

function BoldScoreRow({
  sets,
  compact = false,
}: {
  sets: { me: number | null; opp: number | null; meTb?: number | null; oppTb?: number | null; isCtb?: boolean }[];
  compact?: boolean;
}) {
  const manySets = sets.length > 2;
  const sizeText = compact
    ? manySets
      ? "text-sm"
      : "text-lg"
    : "text-2xl";
  const cellMin = compact ? (manySets ? "min-w-[14px]" : "min-w-[18px]") : "min-w-[26px]";
  const padX = compact ? (manySets ? "px-0.5" : "px-1") : "px-1.5";
  const gap = compact ? (manySets ? "gap-0.5" : "gap-1") : "gap-1.5";
  return (
    <div className={cn("flex tabular-nums", gap)}>
      {sets.map((set, i) => {
        const meWin = set.me != null && set.opp != null && set.me > set.opp;
        const oppWin = set.me != null && set.opp != null && set.opp > set.me;
        const isTb =
          !set.isCtb &&
          ((set.me === 7 && set.opp === 6) || (set.me === 6 && set.opp === 7));
        return (
          <div key={i} className="flex flex-col items-center leading-none gap-0.5">
            <span
              className={cn(
                cellMin, padX, sizeText,
                "text-center py-1 rounded-md font-display font-black",
                meWin ? "bg-graphite text-foreground" : oppWin ? "bg-transparent text-muted-foreground" : "text-muted-foreground",
              )}
            >
              {set.me ?? "-"}
              {isTb && set.meTb != null && (
                <sup className="ml-0.5 text-[10px] font-bold text-optic">{set.meTb}</sup>
              )}
            </span>
            <span
              className={cn(
                cellMin, padX, sizeText,
                "text-center py-1 rounded-md font-display font-black",
                oppWin ? "bg-graphite text-foreground" : meWin ? "bg-transparent text-muted-foreground" : "text-muted-foreground",
              )}
            >
              {set.opp ?? "-"}
              {isTb && set.oppTb != null && (
                <sup className="ml-0.5 text-[10px] font-bold text-optic">{set.oppTb}</sup>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SessionCard({
  s,
  games,
  compact,
  onEdit,
  onDelete,
}: {
  s: Session;
  games: CustomGame[];
  compact: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { visibility } = useSurfaceVisibility();
  const surfaceVisible = visibility[s.surface] !== false;
  const sc = surfaceClasses[s.surface];
  const score = s.score;
  const o = score ? matchOutcome(score.sets) : null;

  // Compose card title.
  // Matches always show a title; training sessions hide it (info already in badge).
  const opponentName = score?.opponent?.trim() || score?.opponentsLabel?.trim() || "";
  const partnerName = score?.partnerName?.trim() || "";
  const ratingSuffix = score?.rating ? ` (${score.rating})` : "";
  let title: string | null = null;
  if (s.mode === "match") {
    title = opponentName ? `vs ${opponentName}${ratingSuffix}` : sessionTitle(s);
  }

  // Badge format label.
  // Training in 2x2 grid: simplified — only "CASUAL" if casual, else nothing
  // Training in list view: ordered CASUAL · SINGLES · DOUBLES (TRAINING prefix already in badge)
  // Match: full SINGLES / DOUBLES
  const formats = s.formats ?? [];
  const isCasual = formats.includes("casual" as Format);
  const orderedFormats = (["casual", "singles", "doubles"] as Format[]).filter((f) => formats.includes(f));
  let formatLabel: string;
  if (s.mode === "training" && compact) {
    formatLabel = isCasual ? "CASUAL" : "";
  } else if (s.mode === "training") {
    formatLabel = orderedFormats.map((f) => f.toUpperCase()).join(" · ");
  } else {
    // Match — exclude "casual" (not meaningful), order singles/doubles
    formatLabel = (["singles", "doubles"] as Format[])
      .filter((f) => formats.includes(f))
      .map((f) => f.toUpperCase())
      .join(" · ");
  }

  void partnerName;

  // Tighter padding in list view; grid keeps a bit more for square aesthetics.
  const padding = compact ? "p-3" : "p-3";
  const cardHeight = compact ? "min-h-[170px]" : "";

  return (
    <div
      className={cn(
        "relative bg-card border border-border rounded-2xl overflow-hidden flex flex-col",
        cardHeight,
      )}
    >
      {/* Surface accent bar — thin vertical stripe on the LEFT edge */}
      {surfaceVisible && (
        <span
          aria-hidden
          className={cn("absolute top-0 left-0 bottom-0 w-1", sc.bg)}
        />
      )}
      <div className={cn("flex flex-col flex-1 pl-2", padding)}>
        <div className="flex items-start gap-2 flex-1">
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest inline-flex items-center gap-1",
                  s.mode === "match"
                    ? s.isInterclub
                      ? "bg-[var(--ic-purple)] text-white"
                      : "bg-optic text-primary-foreground"
                    : "bg-graphite text-foreground",
                )}
              >
                <span>{s.mode === "match" ? "Match" : "Training"}</span>
                {formatLabel && (
                  <>
                    <span className="opacity-60">·</span>
                    <span>{formatLabel}</span>
                  </>
                )}
              </span>
            </div>
            {title && (
              <div className={cn("font-bold leading-tight line-clamp-2 break-words", compact ? "text-sm" : "text-base")}>{title}</div>
            )}
            <MetaLine s={s} compact={compact} />
          </div>

          <KebabMenu onEdit={onEdit} onDelete={onDelete} />
        </div>

        {!compact && <div className="flex-1" />}

        {/* BOTTOM region — score LEFT, badge anchored RIGHT.
            Add right padding so the badge doesn't sit on the surface accent stripe. */}
        <div className={cn("border-t border-border/50 flex flex-wrap items-center gap-x-2 gap-y-1.5 pr-2", compact ? "pt-1.5 mt-1.5 min-h-[40px]" : "pt-2 mt-2 min-h-[48px]")}>
          {score && o ? (
            <>
              <div className="min-w-0 max-w-full overflow-hidden">
                <BoldScoreRow sets={score.sets} compact={compact} />
              </div>
              <div className={cn("shrink-0", compact ? "ml-auto" : "ml-auto")}>
                <ResultBadge result={o.result} />
              </div>
            </>
          ) : (
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
              {s.mode === "training" ? "No score" : "—"}
            </div>
          )}
        </div>

        {!compact && s.customResults && s.customResults.length > 0 && (
          <div className="border-t border-border pt-3 mt-3 flex flex-col gap-1.5">
            <div className="text-base font-bold uppercase tracking-widest text-muted-foreground">Mini-Games</div>
            {s.customResults.map((r) => {
              const g = games.find((x) => x.id === r.gameId);
              return (
                <MiniGameInlineRow
                  key={r.id}
                  name={g?.name ?? "Custom game"}
                  sets={r.sets}
                  partnerName={r.partnerName ?? s.score?.partnerName ?? s.score?.opponent ?? "Partner"}
                />
              );
            })}
          </div>
        )}

        {!compact && s.notes && (
          <div className="text-sm text-muted-foreground border-t border-border pt-3 mt-3">{s.notes}</div>
        )}
      </div>
    </div>
  );
}

function MiniGameInlineRow({
  name,
  sets,
  partnerName,
}: {
  name: string;
  sets: { me: number | null; opp: number | null }[];
  partnerName: string;
}) {
  const meLabel = useMeLabel();
  // Compute aggregate: sum of sets won (or numeric sum for cumulative-like)
  let me = 0, opp = 0;
  for (const set of sets) {
    if (set.me == null || set.opp == null) continue;
    if (set.me > set.opp) me++;
    else if (set.opp > set.me) opp++;
  }
  // Fallback to raw totals if no decided sets
  if (me === 0 && opp === 0) {
    me = sets.reduce((a, s) => a + (s.me ?? 0), 0);
    opp = sets.reduce((a, s) => a + (s.opp ?? 0), 0);
  }
  const meWin = me > opp;
  const oppWin = opp > me;
  const meColor = meWin ? "text-success" : oppWin ? "text-destructive" : "text-foreground";
  const oppColor = oppWin ? "text-success" : meWin ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs pr-2 min-w-0">
      <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground truncate min-w-0">
        {name}
      </span>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)] items-center gap-1.5 tabular-nums">
        <span className="text-muted-foreground/80 truncate text-right min-w-0">{meLabel}</span>
        <span className={cn("font-display font-black text-base leading-none w-5 text-center", meColor)}>{me}</span>
        <span className="text-muted-foreground/60 w-2 text-center">:</span>
        <span className={cn("font-display font-black text-base leading-none w-5 text-center", oppColor)}>{opp}</span>
        <span className="text-muted-foreground/80 truncate text-left min-w-0">{partnerName}</span>
      </div>
      <span aria-hidden />
    </div>
  );
}

export function KebabMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", handle);
    return () => window.removeEventListener("mousedown", handle);
  }, [open]);
  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="size-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-graphite/60 flex items-center justify-center transition"
        aria-label="More actions"
        aria-expanded={open}
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 min-w-[140px] bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-fade-in">
          <button
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="w-full px-3 py-2 text-left text-xs font-bold uppercase tracking-widest text-foreground hover:bg-graphite/60 flex items-center gap-2"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="w-full px-3 py-2 text-left text-xs font-bold uppercase tracking-widest text-destructive hover:bg-destructive/10 flex items-center gap-2"
          >
            <Trash2 className="size-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
