import { useLocalStorage, STORAGE_KEYS } from "@/lib/storage";
import type { CustomGame, GameScoringMode, Player, Session } from "@/lib/types";
import { Plus, ArrowLeft, X, GripVertical, Check, ChevronDown, ChevronRight } from "lucide-react";
import { KebabMenu } from "./SessionsList";
import { useMemo, useState, useEffect } from "react";
import { matchOutcome } from "@/lib/surface";
import { cn } from "@/lib/utils";
import { Scoreboard } from "./Scoreboard";
import { useMeLabel } from "@/lib/identity";
import { ConfirmModal, AlertModal } from "./ConfirmModal";
import { withFriendlyResults, withFriendlyGame, FRIENDLY_GAME_ID } from "@/lib/friendly";
import { sessionIncludesPlayer } from "@/lib/participants";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Label,
} from "recharts";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PanelProps {
  initialPartnerId?: string | null;
  initialGameId?: string | null;
  onClearFilter?: () => void;
  onClearGameId?: () => void;
  onGameDetailBack?: () => void;
}

/** Sort by manual `order`, falling back to creation time (newest first) for legacy items. */
function sortGames(games: CustomGame[]): CustomGame[] {
  return [...games].sort((a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

export function CustomGamesPanel({
  initialPartnerId = null,
  initialGameId = null,
  onClearFilter,
  onClearGameId,
  onGameDetailBack,
}: PanelProps) {
  const [games, setGames] = useLocalStorage<CustomGame[]>(STORAGE_KEYS.customGames, []);
  const [sessions] = useLocalStorage<Session[]>(STORAGE_KEYS.sessions, []);
  const [players] = useLocalStorage<Player[]>(STORAGE_KEYS.players, []);
  const [name, setName] = useState("");
  const [pendingMode, setPendingMode] = useState<{ name: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialGameId);
  const [editingGame, setEditingGame] = useState<CustomGame | null>(null);
  const [partnerFilter, setPartnerFilter] = useState<string | null>(initialPartnerId);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const meLabelGlobal = useMeLabel();

  useEffect(() => {
    setPartnerFilter(initialPartnerId);
  }, [initialPartnerId]);

  useEffect(() => {
    if (initialGameId) {
      setOpenId(initialGameId);
      onClearGameId?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGameId]);

  const sorted = useMemo(() => sortGames(withFriendlyGame(games)), [games]);
  const mergedSessions = useMemo(() => withFriendlyResults(sessions), [sessions]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function startAddGame() {
    const n = name.trim();
    if (!n) return;
    if (games.some((g) => g.name.toLowerCase() === n.toLowerCase())) {
      setAlertMsg("A game with that name already exists.");
      return;
    }
    setPendingMode({ name: n });
  }

  function finalizeAdd(scoringMode: GameScoringMode) {
    if (!pendingMode) return;
    const maxOrder = games.reduce((m, g) => Math.max(m, g.order ?? 0), 0);
    const g: CustomGame = {
      id: crypto.randomUUID(),
      name: pendingMode.name,
      createdAt: new Date().toISOString(),
      scoringMode,
      order: maxOrder + 1,
    };
    setGames([g, ...games]);
    setName("");
    setPendingMode(null);
  }

  function remove(id: string) {
    setConfirmDeleteId(id);
  }

  function confirmRemove() {
    if (!confirmDeleteId) return;
    setGames(games.filter((g) => g.id !== confirmDeleteId));
    setConfirmDeleteId(null);
  }

  function saveEdit(next: { name: string; scoringMode: GameScoringMode }) {
    if (!editingGame) return;
    const trimmed = next.name.trim();
    if (!trimmed) return;
    if (
      games.some((g) => g.id !== editingGame.id && g.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setAlertMsg("Another game already uses that name.");
      return;
    }
    setGames(
      games.map((g) =>
        g.id === editingGame.id ? { ...g, name: trimmed, scoringMode: next.scoringMode } : g,
      ),
    );
    setEditingGame(null);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = sorted.map((g) => g.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    // Don't persist the virtual Friendly Match game into localStorage.
    const realReordered = reordered.filter((g) => g.id !== FRIENDLY_GAME_ID);
    const withOrder = realReordered.map((g, i) => ({ ...g, order: i + 1 }));
    const known = new Set(withOrder.map((g) => g.id));
    setGames([...withOrder, ...games.filter((g) => !known.has(g.id))]);
  }

  const filterPlayer = partnerFilter ? (players.find((p) => p.id === partnerFilter) ?? null) : null;

  function matchesFilter(s: Session, r: { partnerId?: string; partnerName?: string }) {
    if (!partnerFilter || !filterPlayer) return true;
    return (
      r.partnerId === filterPlayer.id ||
      r.partnerName === filterPlayer.name ||
      (!r.partnerId && !r.partnerName && sessionIncludesPlayer(s, filterPlayer))
    );
  }

  const open = sorted.find((g) => g.id === openId) ?? null;
  if (open) {
    return (
      <GameHistoryView
        game={open}
        sessions={mergedSessions}
        partnerFilter={filterPlayer}
        onClearFilter={() => {
          setPartnerFilter(null);
          onClearFilter?.();
        }}
        onBack={() => {
          setOpenId(null);
          onGameDetailBack?.();
        }}
      />
    );
  }

  // Per-game stats — depends on scoring mode
  const stats = sorted.map((g) => {
    let plays = 0;
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let meSum = 0;
    let oppSum = 0;
    for (const s of mergedSessions) {
      for (const r of s.customResults ?? []) {
        if (r.gameId !== g.id) continue;
        if (!matchesFilter(s, r)) continue;
        plays++;
        if ((g.scoringMode ?? "match") === "cumulative") {
          for (const set of r.sets) {
            if (set.me != null) meSum += set.me;
            if (set.opp != null) oppSum += set.opp;
          }
        } else {
          const o = matchOutcome(r.sets);
          if (o.result === "win") wins++;
          else if (o.result === "loss") losses++;
          else draws++;
        }
      }
    }
    return { g, plays, wins, losses, draws, meSum, oppSum };
  });

  const partnerLabel = filterPlayer?.name ?? "Opp";

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold">Mini-Games</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Define drills and side-games. Drag the handle to reorder.
        </p>
      </div>

      {filterPlayer && (
        <div className="bg-optic/10 border-2 border-optic rounded-2xl p-3 flex items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Filtered by partner:</span>{" "}
            <span className="font-bold text-optic">{filterPlayer.name}</span>
          </div>
          <button
            onClick={() => {
              setPartnerFilter(null);
              onClearFilter?.();
            }}
            className="size-8 rounded-full bg-card border border-border flex items-center justify-center"
            aria-label="Clear filter"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="bg-card border-2 border-border rounded-2xl p-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && startAddGame()}
          placeholder="e.g. Volley Drill"
          className="flex-1 bg-transparent text-base focus:outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={startAddGame}
          disabled={!name.trim()}
          className="size-9 rounded-full bg-optic text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:brightness-110 transition"
          aria-label="Add mini-game"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {pendingMode && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setPendingMode(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 flex flex-col gap-4"
          >
            <div>
              <h3 className="text-lg font-bold">Choose scoring mode</h3>
              <p className="text-xs text-muted-foreground mt-1">For "{pendingMode.name}"</p>
            </div>
            <div className="grid gap-2">
              <button
                onClick={() => finalizeAdd("match")}
                className="text-left p-4 rounded-2xl border-2 border-border hover:border-optic transition"
              >
                <div className="text-sm font-bold">Match Logic</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  W/L/D per set, sets tally up.
                </div>
              </button>
              <button
                onClick={() => finalizeAdd("cumulative")}
                className="text-left p-4 rounded-2xl border-2 border-border hover:border-optic transition"
              >
                <div className="text-sm font-bold">Cumulative</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Sum numbers (e.g. total Aces). Single input per session.
                </div>
              </button>
            </div>
            <button
              onClick={() => setPendingMode(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          No mini-games yet. Add one to attach results to sessions.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {stats.map(({ g, plays, wins, losses, draws, meSum, oppSum }) => {
                const isVirtual = g.id === FRIENDLY_GAME_ID;
                return (
                  <SortableGameRow
                    key={g.id}
                    game={g}
                    isVirtual={isVirtual}
                    plays={plays}
                    wins={wins}
                    losses={losses}
                    draws={draws}
                    meSum={meSum}
                    oppSum={oppSum}
                    partnerLabel={partnerLabel}
                    onOpen={() => setOpenId(g.id)}
                    onEdit={() => setEditingGame(g)}
                    onDelete={() => remove(g.id)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editingGame && (
        <EditGameModal game={editingGame} onClose={() => setEditingGame(null)} onSave={saveEdit} />
      )}

      <ConfirmModal
        open={!!confirmDeleteId}
        title="Delete this mini-game?"
        description="The definition will be removed. Existing session results will be kept but unlabeled."
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={confirmRemove}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <AlertModal
        open={!!alertMsg}
        title="Heads up"
        description={alertMsg ?? ""}
        onClose={() => setAlertMsg(null)}
      />
    </section>
  );
}

function SortableGameRow({
  game,
  isVirtual = false,
  plays,
  wins,
  losses,
  draws,
  meSum,
  oppSum,
  partnerLabel,
  onOpen,
  onEdit,
  onDelete,
}: {
  game: CustomGame;
  isVirtual?: boolean;
  plays: number;
  wins: number;
  losses: number;
  draws: number;
  meSum: number;
  oppSum: number;
  partnerLabel: string;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: game.id,
    disabled: isVirtual,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const isCumulative = (game.scoringMode ?? "match") === "cumulative";
  const meLabelGlobal = useMeLabel();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border border-border rounded-2xl p-3 flex items-center gap-2 relative",
        isVirtual && "border-dashed",
      )}
    >
      {isVirtual ? (
        <div
          className="size-8 rounded-md flex items-center justify-center text-[8px] font-black uppercase tracking-wider text-[var(--ic-purple)]"
          aria-hidden
        >
          AUTO
        </div>
      ) : (
        <button
          type="button"
          className="size-8 rounded-md text-muted-foreground/70 hover:text-foreground flex items-center justify-center cursor-grab active:cursor-grabbing touch-none shrink-0"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}

      <button onClick={onOpen} className="flex-1 min-w-0 text-left flex flex-col gap-2 pr-12">
        <div className="flex items-center gap-2 min-w-0 pr-8">
          <div className="text-base font-semibold truncate">{game.name}</div>
          {isCumulative && (
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-graphite/60 text-muted-foreground shrink-0">
              Sum
            </span>
          )}
          {plays > 0 && (
            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
              · {plays} {plays === 1 ? "session" : "sessions"}
            </span>
          )}
        </div>
        {plays === 0 ? (
          <div className="text-xs text-muted-foreground">No results yet</div>
        ) : (
          <div className="w-full">
            <Scoreboard
              size="md"
              leftLabel={meLabelGlobal}
              rightLabel={partnerLabel}
              leftScore={isCumulative ? meSum : wins}
              rightScore={isCumulative ? oppSum : losses}
              draws={isCumulative ? 0 : draws}
            />
          </div>
        )}
      </button>

      {/* Chevron — subtle clickability hint, anchored bottom-right so it doesn't collide with the kebab. */}
      <ChevronRight
        aria-hidden
        className="absolute bottom-3 right-3 size-4 text-muted-foreground/50 pointer-events-none"
      />

      {!isVirtual && (
        <div className="absolute top-2 right-2">
          <KebabMenu onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

function EditGameModal({
  game,
  onClose,
  onSave,
}: {
  game: CustomGame;
  onClose: () => void;
  onSave: (next: { name: string; scoringMode: GameScoringMode }) => void;
}) {
  const [name, setName] = useState(game.name);
  const [mode, setMode] = useState<GameScoringMode>(game.scoringMode ?? "match");

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Edit Mini-Game</h3>
          <button
            onClick={onClose}
            className="size-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-background border-2 border-border rounded-xl px-3.5 py-3 text-base font-medium focus:outline-none focus:border-optic"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Scoring Mode
          </label>
          <div className="flex gap-2 p-1 bg-graphite/40 rounded-full">
            {(
              [
                { id: "match", label: "Match Logic" },
                { id: "cumulative", label: "Cumulative" },
              ] as { id: GameScoringMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id)}
                className={cn(
                  "flex-1 px-3 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition",
                  mode === opt.id ? "bg-optic text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {mode === "match"
              ? "Each result counts as W/L/D based on score."
              : "Stats sum the absolute numbers entered (e.g. total Aces). Past entries reinterpret automatically."}
          </p>
        </div>

        <button
          onClick={() => onSave({ name, scoringMode: mode })}
          className="w-full py-3 rounded-2xl bg-optic text-primary-foreground font-bold text-sm hover:brightness-110 transition flex items-center justify-center gap-2"
        >
          <Check className="size-4" /> Save
        </button>
      </div>
    </div>
  );
}

function GameHistoryView({
  game,
  sessions,
  partnerFilter,
  onClearFilter,
  onBack,
}: {
  game: CustomGame;
  sessions: Session[];
  partnerFilter: Player | null;
  onClearFilter: () => void;
  onBack: () => void;
}) {
  const meLabelGlobal = useMeLabel();
  const entries = useMemo(() => {
    const out: {
      sessionId: string;
      date: string;
      opponent: string;
      sets: { me: number | null; opp: number | null }[];
    }[] = [];
    for (const s of sessions) {
      for (const r of s.customResults ?? []) {
        if (r.gameId !== game.id) continue;
        if (partnerFilter) {
          const ok =
            r.partnerId === partnerFilter.id ||
            r.partnerName === partnerFilter.name ||
            (!r.partnerId && !r.partnerName && sessionIncludesPlayer(s, partnerFilter));
          if (!ok) continue;
        }
        // Variable safety: prefer mini-game partner, fall back to session opponent/partner
        const oppName =
          r.partnerName ||
          s.score?.opponent ||
          s.score?.partnerName ||
          s.score?.opponentsLabel ||
          "Partner";
        out.push({
          sessionId: s.id,
          date: s.date,
          opponent: oppName,
          sets: r.sets,
        });
      }
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [game, sessions, partnerFilter]);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="size-9 rounded-full bg-card border border-border flex items-center justify-center hover:border-foreground/40"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0">
          <h2 className="text-xl font-bold truncate">{game.name}</h2>
          <div className="text-xs text-muted-foreground">{entries.length} results</div>
        </div>
      </div>

      {partnerFilter && (
        <div className="bg-optic/10 border-2 border-optic rounded-2xl p-3 flex items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Filtered:</span>{" "}
            <span className="font-bold text-optic">vs {partnerFilter.name}</span>
          </div>
          <button
            onClick={onClearFilter}
            className="size-8 rounded-full bg-card border border-border flex items-center justify-center"
            aria-label="Clear filter"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <LongestStreakBadge
        entries={entries}
        meLabel={meLabelGlobal}
        partnerLabel={partnerFilter?.name ?? "Partner"}
      />

      <GameHistoryTrend
        game={game}
        entries={entries}
        meLabel={meLabelGlobal}
        partnerLabel={partnerFilter?.name ?? "Partner"}
      />

      {entries.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          No results yet. Add this game to a session.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((e, idx) => {
            const o = matchOutcome(e.sets);
            const meWin = o.result === "win";
            const oppWin = o.result === "loss";
            return (
              <div
                key={idx}
                className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground tabular-nums shrink-0">
                    {new Date(e.date).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate min-w-0 text-right">
                    vs {e.opponent}
                  </div>
                </div>
                <ScoreRow label={meLabelGlobal} sets={e.sets} which="me" win={meWin} />
                <ScoreRow label={e.opponent} sets={e.sets} which="opp" win={oppWin} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LongestStreakBadge({
  entries,
  meLabel,
  partnerLabel: _partnerLabel,
}: {
  entries: { date: string; opponent: string; sets: { me: number | null; opp: number | null }[] }[];
  meLabel: string;
  partnerLabel: string;
}) {
  // Partner-specific streaks: group entries by opponent (partner) and compute
  // the longest consecutive-win run for "me" and for the partner WITHIN each
  // partner's history. Then pick the overall leader across partners.
  const { meBest, partnerBest } = useMemo(() => {
    const byPartner = new Map<string, typeof entries>();
    for (const e of entries) {
      const key = e.opponent || "Partner";
      const arr = byPartner.get(key) ?? [];
      arr.push(e);
      byPartner.set(key, arr);
    }

    let meBest: { name: string; n: number } | null = null;
    let partnerBest: { name: string; n: number } | null = null;

    for (const [name, list] of byPartner) {
      const ordered = [...list].sort((a, b) => (a.date < b.date ? -1 : 1));
      let me = 0,
        opp = 0,
        curMe = 0,
        curOpp = 0;
      for (const e of ordered) {
        const o = matchOutcome(e.sets);
        if (o.result === "win") {
          curMe += 1;
          curOpp = 0;
          if (curMe > me) me = curMe;
        } else if (o.result === "loss") {
          curOpp += 1;
          curMe = 0;
          if (curOpp > opp) opp = curOpp;
        } else {
          curMe = 0;
          curOpp = 0;
        }
      }
      if (me > 0 && (!meBest || me > meBest.n)) meBest = { name, n: me };
      if (opp > 0 && (!partnerBest || opp > partnerBest.n)) partnerBest = { name, n: opp };
    }

    return { meBest, partnerBest };
  }, [entries]);

  if (!meBest && !partnerBest) return null;

  // Show the overall leader. If tied, show both.
  const leaders: { who: string; vs: string; n: number }[] = [];
  const meN = meBest?.n ?? 0;
  const partnerN = partnerBest?.n ?? 0;
  if (meN >= partnerN && meBest) leaders.push({ who: meLabel, vs: meBest.name, n: meBest.n });
  if (partnerN >= meN && partnerBest)
    leaders.push({ who: partnerBest.name, vs: meLabel, n: partnerBest.n });

  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 flex items-center justify-between gap-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Longest Streak
      </span>
      <div className="flex items-center gap-2 text-xs font-semibold">
        {leaders.map((l, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span className="truncate max-w-[120px]">{l.who}</span>
            <span className="tabular-nums text-optic">({l.n})</span>
            <span className="text-muted-foreground font-normal">vs {l.vs}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function GameHistoryTrend({
  game,
  entries,
  meLabel,
  partnerLabel,
}: {
  game: CustomGame;
  entries: { date: string; sets: { me: number | null; opp: number | null }[] }[];
  meLabel: string;
  partnerLabel: string;
}) {
  const [open, setOpen] = useState(true);
  const isFriendly = game.id === FRIENDLY_GAME_ID;

  // Friendly: cumulative NET per MATCH. +1 for a match win, -1 for a loss, 0 for draw.
  const friendlyData = useMemo(() => {
    if (!isFriendly) return [];
    const ordered = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
    let net = 0;
    return ordered.map((e, i) => {
      const o = matchOutcome(e.sets);
      if (o.result === "win") net += 1;
      else if (o.result === "loss") net -= 1;
      return { idx: i + 1, label: e.date.slice(5), net };
    });
  }, [entries, isFriendly]);

  // Standard: trendline of me/opp per session
  const points = useMemo(() => {
    if (isFriendly) return [];
    const isCumulative = (game.scoringMode ?? "match") === "cumulative";
    return [...entries]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(-12)
      .map((e) => {
        if (isCumulative) {
          return {
            label: e.date.slice(5),
            me: e.sets.reduce((sum, set) => sum + (set.me ?? 0), 0),
            opp: e.sets.reduce((sum, set) => sum + (set.opp ?? 0), 0),
          };
        }
        let me = 0,
          opp = 0;
        for (const set of e.sets) {
          if (set.me == null || set.opp == null) continue;
          if (set.me > set.opp) me++;
          else if (set.opp > set.me) opp++;
        }
        return { label: e.date.slice(5), me, opp };
      });
  }, [entries, game, isFriendly]);

  const hasData = isFriendly ? friendlyData.length > 0 : points.length > 0;
  if (!hasData) return null;

  // Linear regression for non-friendly trendline
  const n = points.length;
  const meanX = (n - 1) / 2;
  const meanY = points.reduce((sum, p) => sum + p.me, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (points[i].me - meanY);
    den += (i - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  const data = points.map((p, i) => ({ ...p, trend: +(intercept + slope * i).toFixed(2) }));

  // Y-axis domain symmetric around zero for the friendly chart
  const friendlyAbs = Math.max(1, ...friendlyData.map((p) => Math.abs(p.net)));

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3"
        aria-expanded={open}
      >
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {isFriendly ? "Cumulative Set Lead" : "Trend"}
        </span>
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="border-t border-border p-3 animate-fade-in">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {isFriendly ? (
                <LineChart
                  data={friendlyData}
                  margin={{ top: 18, right: 20, left: 18, bottom: 24 }}
                >
                  <CartesianGrid stroke="var(--border)" strokeOpacity={0.25} vertical={false} />
                  <XAxis
                    dataKey="idx"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    label={{
                      value: "Cumulative Sessions",
                      position: "insideBottom",
                      offset: -10,
                      fontSize: 10,
                      fill: "var(--muted-foreground)",
                    }}
                  />
                  <YAxis
                    domain={[-friendlyAbs, friendlyAbs]}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    allowDecimals={false}
                  >
                    <Label
                      value={meLabel}
                      position="top"
                      offset={10}
                      fontSize={10}
                      fontWeight={700}
                      fill="var(--optic)"
                    />
                    <Label
                      value={partnerLabel}
                      position="bottom"
                      offset={14}
                      fontSize={10}
                      fontWeight={700}
                      fill="var(--muted-foreground)"
                    />
                  </YAxis>
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    labelFormatter={(v) => `Session ${v}`}
                    formatter={(v: number) => [
                      v > 0
                        ? `+${v} for ${meLabel}`
                        : v < 0
                          ? `${v} (${partnerLabel} ahead)`
                          : "Even",
                      "Net Matches",
                    ]}
                  />
                  <ReferenceLine y={0} stroke="var(--border)" strokeOpacity={0.7} />
                  <Line
                    type="linear"
                    dataKey="net"
                    stroke="var(--optic)"
                    strokeWidth={2.25}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              ) : (
                <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeOpacity={0.25} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={26}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="me"
                    name={meLabel}
                    stroke="var(--optic)"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="opp"
                    name="Opp"
                    stroke="var(--muted-foreground)"
                    strokeWidth={1.25}
                    strokeDasharray="3 3"
                    dot={{ r: 1.75 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="trend"
                    name="Trend"
                    stroke="var(--optic)"
                    strokeWidth={1.25}
                    strokeDasharray="2 4"
                    strokeOpacity={0.75}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreRow({
  label,
  sets,
  which,
  win,
}: {
  label: string;
  sets: { me: number | null; opp: number | null }[];
  which: "me" | "opp";
  win: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border-2 px-3 py-2",
        win ? "border-success" : "border-border",
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-widest min-w-0 flex-1 text-muted-foreground truncate">
        {label}
      </div>
      <div className="flex gap-2 shrink-0">
        {sets.map((s, i) => (
          <div
            key={i}
            className={cn(
              "min-w-[2ch] text-center font-display text-2xl font-bold tabular-nums leading-none",
              win ? "text-success" : "text-foreground",
            )}
          >
            {s[which] ?? "-"}
          </div>
        ))}
      </div>
    </div>
  );
}
