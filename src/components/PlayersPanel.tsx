import { useLocalStorage, STORAGE_KEYS } from "@/lib/storage";
import type { CustomGame, OpponentRating, Player, Session } from "@/lib/types";
import { OPPONENT_RATINGS } from "@/lib/types";
import { useMemo, useState } from "react";
import { Plus, Archive, ChevronRight, ArrowLeft, ChevronDown, Pencil, RotateCcw, GripVertical, Star, Trash2 } from "lucide-react";
import { surfaceClasses, matchOutcome, formatDuration } from "@/lib/surface";
import { cn } from "@/lib/utils";
import { Scoreboard } from "./Scoreboard";
import { ConfirmModal } from "./ConfirmModal";
import { withFriendlyResults, withFriendlyGame } from "@/lib/friendly";
import { wlClass } from "@/lib/wlColor";
import { useMeLabel } from "@/lib/identity";
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

interface Props {
  embedded?: boolean;
  onOpenGamesForPlayer?: (playerId: string) => void;
  /** When false, hide all editing controls (add input, drag handle, pencil). */
  editMode?: boolean;
}

export function PlayersPanel({ embedded = false, onOpenGamesForPlayer, editMode = true }: Props) {
  const [players, setPlayers] = useLocalStorage<Player[]>(STORAGE_KEYS.players, []);
  const [sessions, setSessions] = useLocalStorage<Session[]>(STORAGE_KEYS.sessions, []);
  const [games] = useLocalStorage<CustomGame[]>(STORAGE_KEYS.customGames, []);
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editClassification, setEditClassification] = useState<OpponentRating | "">("");
  const [showArchived, setShowArchived] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Player | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);

  const sortFn = (a: Player, b: Player) => {
    const af = a.isFavorite ? 0 : 1;
    const bf = b.isFavorite ? 0 : 1;
    if (af !== bf) return af - bf;
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return a.createdAt < b.createdAt ? 1 : -1;
  };

  const activePlayers = useMemo(
    () => players.filter((p) => !p.isArchived).sort(sortFn),
    [players],
  );
  const archivedPlayers = useMemo(
    () => players.filter((p) => p.isArchived).sort(sortFn),
    [players],
  );
  // Kept for backward compat with existing dnd handler
  const visiblePlayers = activePlayers;
  const archivedCount = archivedPlayers.length;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = visiblePlayers.map((p) => p.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(visiblePlayers, oldIndex, newIndex).map((p, i) => ({ ...p, order: i + 1 }));
    const known = new Set(reordered.map((p) => p.id));
    setPlayers([...reordered, ...players.filter((p) => !known.has(p.id))]);
  }

  function addPlayer() {
    const n = name.trim();
    if (!n) return;
    if (players.some((p) => p.name.toLowerCase() === n.toLowerCase())) {
      return;
    }
    const p: Player = { id: crypto.randomUUID(), name: n, createdAt: new Date().toISOString() };
    setPlayers([p, ...players]);
    setName("");
  }

  function archivePlayer(p: Player) {
    setArchiveTarget(p);
  }

  function confirmArchive() {
    if (!archiveTarget) return;
    setPlayers(players.map((x) => (x.id === archiveTarget.id ? { ...x, isArchived: true } : x)));
    setEditingId(null);
    setArchiveTarget(null);
  }

  function unarchivePlayer(p: Player) {
    setPlayers(players.map((x) => (x.id === p.id ? { ...x, isArchived: false } : x)));
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setPlayers(players.filter((x) => x.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function toggleFavoritePlayer(p: Player) {
    setPlayers(players.map((x) => (x.id === p.id ? { ...x, isFavorite: !x.isFavorite } : x)));
  }

  function setPlayerAvatar(p: Player, dataUrl: string | undefined) {
    setPlayers(players.map((x) => (x.id === p.id ? { ...x, avatarDataUrl: dataUrl } : x)));
  }

  function startEdit(p: Player) {
    setEditingId(p.id);
    setEditValue(p.name);
    setEditClassification(p.classification ?? "");
  }

  function saveEdit() {
    if (!editingId) return;
    const next = editValue.trim();
    if (!next) {
      setEditingId(null);
      return;
    }
    const original = players.find((p) => p.id === editingId);
    if (!original) {
      setEditingId(null);
      return;
    }
    const oldName = original.name;
    setPlayers(
      players.map((p) =>
        p.id === editingId
          ? { ...p, name: next, classification: editClassification || undefined }
          : p,
      ),
    );
    if (oldName !== next) {
      setSessions(
        sessions.map((s) => {
          let updated = s;
          if (s.score?.opponentId === editingId || s.score?.opponent === oldName) {
            updated = { ...updated, score: { ...s.score!, opponent: next } };
          }
          if (updated.customResults?.some((r) => r.partnerId === editingId || r.partnerName === oldName)) {
            updated = {
              ...updated,
              customResults: updated.customResults!.map((r) =>
                r.partnerId === editingId || r.partnerName === oldName
                  ? { ...r, partnerName: next }
                  : r,
              ),
            };
          }
          return updated;
        }),
      );
    }
    setEditingId(null);
  }

  const open = players.find((p) => p.id === openId) ?? null;

  if (open) {
    return (
      <H2HView
        player={open}
        sessions={sessions}
        games={games}
        onBack={() => setOpenId(null)}
        onOpenGames={onOpenGamesForPlayer}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {!embedded && (
        <div>
          <h2 className="text-2xl font-bold">Players</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage opponents. Tap one to see your head-to-head record.
          </p>
        </div>
      )}

      <div className="bg-card border-2 border-border rounded-2xl p-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPlayer()}
          placeholder="+ Add a Player"
          className="flex-1 bg-transparent text-base focus:outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={addPlayer}
          disabled={!name.trim()}
          className="size-9 rounded-full bg-optic text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:brightness-110 transition"
          aria-label="Add player"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {(() => {
        const renderRow = (p: Player) => {
          const friendlies = sessions.filter(
            (s) =>
              s.mode === "training" &&
              s.score &&
              s.score.sets.some((set) => set.me != null || set.opp != null) &&
              (s.score.partnerId === p.id ||
                s.score.opponentId === p.id ||
                s.score.partnerName === p.name ||
                s.score.opponent === p.name),
          );
          let w = 0, l = 0;
          for (const s of friendlies) {
            const o = matchOutcome(s.score!.sets);
            if (o.result === "win") w++;
            else if (o.result === "loss") l++;
          }
          return (
            <SortablePlayerRow
              key={p.id}
              player={p}
              isEditing={editingId === p.id}
              editValue={editValue}
              setEditValue={setEditValue}
              editClassification={editClassification}
              setEditClassification={setEditClassification}
              onSave={saveEdit}
              onCancelEdit={() => setEditingId(null)}
              onStartEdit={() => startEdit(p)}
              onOpen={() => setOpenId(p.id)}
              onArchive={() => archivePlayer(p)}
              onUnarchive={() => unarchivePlayer(p)}
              onToggleFavorite={() => toggleFavoritePlayer(p)}
              onSetAvatar={(d) => setPlayerAvatar(p, d)}
              onDelete={() => setDeleteTarget(p)}
              friendlies={friendlies.length}
              w={w}
              l={l}
              editMode={editMode}
            />
          );
        };

        return (
          <>
            {activePlayers.length === 0 ? (
              <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
                No players yet. Add one to use them as opponents in sessions.
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={activePlayers.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2">
                    {activePlayers.map(renderRow)}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {archivedCount > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                <button
                  onClick={() => setShowArchived((v) => !v)}
                  className="self-start flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                  aria-expanded={showArchived}
                >
                  <ChevronDown
                    className={cn("size-3 transition-transform", !showArchived && "-rotate-90")}
                  />
                  Archived ({archivedCount})
                </button>
                {showArchived && (
                  <div className="flex flex-col gap-2 animate-fade-in">
                    {archivedPlayers.map(renderRow)}
                  </div>
                )}
              </div>
            )}
          </>
        );
      })()}

      <ConfirmModal
        open={!!archiveTarget}
        title={archiveTarget ? `Archive ${archiveTarget.name}?` : "Archive player?"}
        description="They will be hidden from new session dropdowns. Historical stats stay intact and you can restore them later from 'Show archived'."
        confirmLabel="Archive"
        tone="destructive"
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : "Delete player?"}
        description="This permanently removes the player. Past sessions stay but the link is broken. Use Archive instead if you want to keep stats."
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}

function SortablePlayerRow({
  player: p,
  isEditing,
  editValue,
  setEditValue,
  editClassification,
  setEditClassification,
  onSave,
  onCancelEdit,
  onStartEdit,
  onOpen,
  onArchive,
  onUnarchive,
  onToggleFavorite,
  onSetAvatar,
  onDelete,
  friendlies,
  w,
  l,
  editMode = true,
}: {
  player: Player;
  isEditing: boolean;
  editValue: string;
  setEditValue: (v: string) => void;
  editClassification: OpponentRating | "";
  setEditClassification: (v: OpponentRating | "") => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onOpen: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onToggleFavorite: () => void;
  onSetAvatar: (dataUrl: string | undefined) => void;
  onDelete: () => void;
  friendlies: number;
  w: number;
  l: number;
  editMode?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: p.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };


  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border rounded-2xl p-3 flex flex-col gap-2 transition-all",
        p.isFavorite && !p.isArchived
          ? "border-2 border-[var(--star-yellow)]"
          : "border-border",
      )}
    >
      {isEditing ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative size-9 rounded-full bg-graphite flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
              {p.avatarDataUrl ? (
                <img src={p.avatarDataUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <span>{(editValue || p.name).slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={onSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") onCancelEdit();
              }}
              className="flex-1 min-w-0 bg-background border-2 border-optic rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none"
            />
            <select
              value={editClassification}
              onChange={(e) => setEditClassification(e.target.value as OpponentRating | "")}
              className="bg-background border-2 border-border rounded-lg px-2 py-1.5 text-xs font-bold tabular-nums focus:outline-none focus:border-optic"
              aria-label="Classification"
            >
              <option value="">R-</option>
              {OPPONENT_RATINGS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end pt-1 border-t border-border/60">
            {p.isArchived ? (
              <button
                onClick={onUnarchive}
                className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-1.5"
              >
                <RotateCcw className="size-3.5" /> Restore
              </button>
            ) : (
              <button
                onClick={onArchive}
                className="text-[11px] font-bold uppercase tracking-widest text-destructive/80 hover:text-destructive flex items-center gap-1.5"
              >
                <Archive className="size-3.5" /> Archive player
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="relative size-10 rounded-full bg-graphite flex items-center justify-center font-bold text-base shrink-0 overflow-hidden">
              {p.avatarDataUrl ? (
                <img src={p.avatarDataUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <span>{p.name.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <button
              type="button"
              onClick={editMode ? undefined : onOpen}
              disabled={editMode}
              className="flex-1 flex items-center gap-3 min-w-0 text-left disabled:cursor-default"
            >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-semibold truncate">{p.name}</div>
                {p.classification && (
                  <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full bg-graphite/70 text-foreground">
                    {p.classification}
                  </span>
                )}
              </div>
              {!editMode && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {friendlies} {friendlies === 1 ? "friendly" : "friendlies"} ·{" "}
                  <span className={cn("font-semibold", wlClass(w, l))}>{w}W / {l}L</span>
                </div>
              )}
            </div>
            </button>
            {!p.isArchived && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              className="size-8 rounded-full hover:scale-110 hover:bg-[var(--star-yellow)]/10 flex items-center justify-center transition shrink-0"
              aria-label={p.isFavorite ? "Unstar player" : "Star player"}
              aria-pressed={!!p.isFavorite}
            >
              <Star
                className={cn(
                  "size-4 transition-colors",
                  p.isFavorite
                    ? "fill-[var(--star-yellow)] text-[var(--star-yellow)]"
                    : "text-muted-foreground/50",
                )}
              />
            </button>
            )}
            {editMode && (
              <button
                type="button"
                onClick={onStartEdit}
                className="size-8 rounded-full text-muted-foreground hover:text-foreground flex items-center justify-center transition shrink-0"
                aria-label="Edit player"
              >
                <Pencil className="size-4" />
              </button>
            )}

            {editMode && (
              <>
                {p.isArchived ? (
                  <button
                    type="button"
                    onClick={onUnarchive}
                    className="size-8 rounded-full text-muted-foreground hover:text-optic flex items-center justify-center transition shrink-0"
                    aria-label="Restore player"
                  >
                    <RotateCcw className="size-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onArchive}
                    className="size-8 rounded-full text-muted-foreground/70 hover:text-destructive flex items-center justify-center transition shrink-0"
                    aria-label="Archive player"
                  >
                    <Archive className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDelete}
                  className="size-8 rounded-full text-muted-foreground/60 hover:text-destructive flex items-center justify-center transition shrink-0"
                  aria-label="Delete player"
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
            {!editMode && <ChevronRight className="size-4 text-muted-foreground shrink-0" />}
          </div>
        </div>
      )}
    </div>
  );
}

function H2HView({
  player,
  sessions,
  games,
  onBack,
  onOpenGames,
}: {
  player: Player;
  sessions: Session[];
  games: CustomGame[];
  onBack: () => void;
  onOpenGames?: (playerId: string) => void;
}) {
  const [matchesOpen, setMatchesOpen] = useState(false);
  const meLabel = useMeLabel();

  const vs = useMemo(
    () =>
      sessions
        .filter((s) => {
          // Match opponent linkage
          if (s.score && (s.score.opponentId === player.id || s.score.opponent === player.name)) return true;
          // Training partner linkage via mini-games
          if (s.customResults?.some((r) => r.partnerId === player.id || r.partnerName === player.name)) return true;
          return false;
        })
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [sessions, player],
  );

  const totalSessions = vs.length;
  const totalMin = vs.reduce((a, s) => a + s.durationMin, 0);

  const matchSessions = vs.filter((s) => s.mode === "match" && s.score);
  let mW = 0, mL = 0, mD = 0;
  for (const s of matchSessions) {
    const o = matchOutcome(s.score!.sets);
    if (o.result === "win") mW++;
    else if (o.result === "loss") mL++;
    else mD++;
  }

  const perGame: { game: CustomGame; w: number; l: number; d: number; plays: number; meSum: number; oppSum: number }[] = [];
  const mergedGames = withFriendlyGame(games);
  const mergedSessions = withFriendlyResults(vs);
  for (const g of [...mergedGames].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))) {
    let w = 0, l = 0, d = 0, plays = 0, meSum = 0, oppSum = 0;
    for (const s of mergedSessions) {
      for (const r of s.customResults ?? []) {
        if (r.gameId !== g.id) continue;
        const matchesPartner =
          r.partnerId === player.id ||
          r.partnerName === player.name ||
          (!r.partnerId && !r.partnerName && (s.score?.opponentId === player.id || s.score?.opponent === player.name));
        if (!matchesPartner) continue;
        plays++;
        if ((g.scoringMode ?? "match") === "cumulative") {
          for (const set of r.sets) {
            if (set.me != null) meSum += set.me;
            if (set.opp != null) oppSum += set.opp;
          }
        } else {
          const o = matchOutcome(r.sets);
          if (o.result === "win") w++;
          else if (o.result === "loss") l++;
          else d++;
        }
      }
    }
    if (plays > 0) perGame.push({ game: g, w, l, d, plays, meSum, oppSum });
  }

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
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-12 rounded-full bg-graphite flex items-center justify-center text-lg font-bold shrink-0">
            {player.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold truncate">{player.name}</h2>
            <div className="text-xs text-muted-foreground">Head-to-head</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sessions Together</div>
          <div className="text-3xl font-bold tabular-nums leading-none">{totalSessions}</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Time</div>
          <div className="text-3xl font-bold tabular-nums leading-none">{formatDuration(totalMin)}</div>
        </div>
      </div>

      {/* Mini-games vs them — tap to deep-link into Games tab filtered by this player */}
      <button
        type="button"
        onClick={() => onOpenGames?.(player.id)}
        disabled={!onOpenGames || perGame.length === 0}
        className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 text-left hover:border-foreground/40 transition disabled:cursor-default disabled:hover:border-border"
      >
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mini-Games vs {player.name}</div>
          {onOpenGames && perGame.length > 0 && (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </div>
        {perGame.length === 0 ? (
          <div className="text-sm text-muted-foreground py-2">No mini-game results vs this player yet.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {perGame.map(({ game, w, l, d, plays, meSum, oppSum }) => {
              const isCum = (game.scoringMode ?? "match") === "cumulative";
              return (
                <div key={game.id} className="flex flex-col gap-1.5 py-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate flex-1">{game.name}</div>
                    {isCum && (
                      <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-graphite/60 text-muted-foreground">
                        Sum
                      </span>
                    )}
                  </div>
                  <Scoreboard
                    size="sm"
                    leftLabel={meLabel}
                    rightLabel={player.name}
                    leftScore={isCum ? meSum : w}
                    rightScore={isCum ? oppSum : l}
                    draws={isCum ? 0 : d}
                    caption={isCum ? `${plays} ${plays === 1 ? "session" : "sessions"}` : undefined}
                  />
                </div>
              );
            })}
          </div>
        )}
      </button>

      {/* Collapsible Official Matches */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <button
          onClick={() => setMatchesOpen((v) => !v)}
          className="w-full p-5 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Official Matches</div>
            <div className={cn("text-sm font-bold tabular-nums", wlClass(mW, mL))}>
              {mW}W / {mL}L
              {mD > 0 && <span className="text-muted-foreground">{" / "}{mD}D</span>}
            </div>
          </div>
          <ChevronDown className={cn("size-5 text-muted-foreground transition-transform", matchesOpen && "rotate-180")} />
        </button>
        {matchesOpen && (
          <div className="px-5 pb-5 flex flex-col gap-2 border-t border-border pt-3">
            {matchSessions.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">No official matches yet.</div>
            ) : (
              matchSessions.map((s) => {
                const sc = surfaceClasses[s.surface];
                const o = matchOutcome(s.score!.sets);
                return (
                  <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
                    <span className={cn("size-2.5 rounded-full shrink-0", sc.dot)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {new Date(s.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatDuration(s.durationMin)}
                      </div>
                    </div>
                    <div className="flex gap-1.5 text-sm tabular-nums font-semibold">
                      {s.score!.sets.map((set, i) => (
                        <div key={i} className="flex flex-col items-center text-xs leading-tight">
                          <span>{set.me ?? "-"}</span>
                          <span className="text-muted-foreground">{set.opp ?? "-"}</span>
                        </div>
                      ))}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-widest shrink-0",
                        o.result === "win" && "text-optic",
                        o.result === "loss" && "text-destructive",
                        o.result === "draw" && "text-muted-foreground",
                      )}
                    >
                      {o.result === "win" ? "W" : o.result === "loss" ? "L" : "D"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </section>
  );
}
