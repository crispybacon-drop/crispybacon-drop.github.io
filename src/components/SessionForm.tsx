import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage, STORAGE_KEYS } from "@/lib/storage";
import type {
  CustomGame,
  CustomGameResult,
  Format,
  OpponentRating,
  Player,
  SavedLocation,
  Score,
  Session,
  SessionMode,
  SetScore,
  Surface,
} from "@/lib/types";
import { SURFACES, OPPONENT_RATINGS } from "@/lib/types";
import { surfaceClasses } from "@/lib/surface";
import { useMeLabel } from "@/lib/identity";
import { useSurfaceVisibility } from "@/lib/visibleSurfaces";
import {
  useDefaultSurface,
  useMaxSets,
  useLocationVisibility,
  useCumulativeMaxSets,
} from "@/lib/settings";
import { cn } from "@/lib/utils";
import { ScoreGrid } from "./ScoreGrid";
import { AnimatedTabs } from "./AnimatedTabs";

import { AlertModal } from "./ConfirmModal";
import { isMatchDecided } from "@/lib/matchProgress";
import { isLegalSet, isLegalChampionsTiebreak, isTiebreakConsistent } from "@/lib/tennisRules";
import { splitParticipantNames } from "@/lib/participants";
import { Plus, Trash2, Check, X, Clock, Star, ChevronDown } from "lucide-react";

interface Props {
  onSaved: () => void;
  onCancel?: () => void;
  editing?: Session;
}

const formatLabel: Record<Format, string> = {
  singles: "Singles",
  doubles: "Doubles",
  casual: "Casual",
};

const inputClass =
  "bg-background border-2 border-border rounded-xl px-3.5 py-3 text-base font-medium focus:outline-none focus:border-optic focus:bg-card transition-colors w-full placeholder:text-muted-foreground/70";

export function SessionForm({ onSaved, onCancel, editing }: Props) {
  const [sessions, setSessions] = useLocalStorage<Session[]>(STORAGE_KEYS.sessions, []);
  const [players] = useLocalStorage<Player[]>(STORAGE_KEYS.players, []);
  const [games] = useLocalStorage<CustomGame[]>(STORAGE_KEYS.customGames, []);
  const [savedLocations, setSavedLocations] = useLocalStorage<SavedLocation[]>(
    STORAGE_KEYS.locations,
    [],
  );
  const [myClassification] = useLocalStorage<OpponentRating | "">(
    STORAGE_KEYS.myClassification,
    "",
  );
  const { visibleSurfaces } = useSurfaceVisibility();
  const [defaultSurface] = useDefaultSurface();
  const [maxSets] = useMaxSets();
  const [cumulativeMaxSets] = useCumulativeMaxSets();
  const [hiddenLocations] = useLocationVisibility();
  void defaultSurface;

  const [mode, setMode] = useState<SessionMode>(editing?.mode ?? "match");
  // No default surface pre-selection — user must choose. (Editing keeps prior choice.)
  const [surface, setSurface] = useState<Surface | "">(editing?.surface ?? "");
  const [date, setDate] = useState(editing?.date ?? new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState<string>(
    editing?.durationMin != null ? String(editing.durationMin) : "60",
  );
  const [showStartTime, setShowStartTime] = useState(!!editing?.startTime);
  const [startTime, setStartTime] = useState(editing?.startTime ?? "");
  // Match: single-select format. Training: multi-select (any combination of singles/doubles/casual).
  const [format, setFormat] = useState<Format | "">(
    (editing?.formats?.[0] as Format | undefined) ?? "",
  );
  const [trainingFormats, setTrainingFormats] = useState<Format[]>(
    editing?.mode === "training" && editing.formats?.length ? (editing.formats as Format[]) : [],
  );
  const initialTrainingOpponents = (() => {
    if (!editing?.score) return [] as string[];
    const sc = editing.score;
    const ids = sc.opponentIds ?? [];
    if (ids.length > 0) return ids;
    const labels = splitParticipantNames(sc?.opponentsLabel || sc?.opponent);
    return labels
      .map((name) => players.find((p) => p.name.toLowerCase() === name.toLowerCase())?.id ?? "")
      .filter(Boolean);
  })();
  // Doubles training: 3-person picker (1 partner + 2 opponents)
  const [trainingOppAId, setTrainingOppAId] = useState<string>(initialTrainingOpponents[0] ?? "");
  const [trainingOppBId, setTrainingOppBId] = useState<string>(initialTrainingOpponents[1] ?? "");
  const [isInterclub, setIsInterclub] = useState(editing?.isInterclub ?? false);
  const [location, setLocation] = useState(editing?.location ?? "");
  const [showLocationInput, setShowLocationInput] = useState(false);
  const editingPrimaryId = editing?.score?.partnerId ?? editing?.score?.opponentId ?? "";
  // Detect a once-only / ghost opponent/partner: primary participant name present but no Player.id link.
  const editingGhostName = (() => {
    const sc = editing?.score;
    if (!sc) return "";
    if (editingPrimaryId) return "";
    if (editing?.formats?.includes("doubles")) return (sc.partnerName || "").trim();
    return (sc.partnerName || sc.opponent || "").trim();
  })();
  const [opponentId, setOpponentId] = useState<string>(
    editingPrimaryId || (editingGhostName ? "__new__" : ""),
  );
  // Singles training (incl. casual): additional partners (rotating hitting groups).
  // Each entry can be a known player (id set) or a ghost text-only name.
  type ExtraPartner = { id?: string; name: string };
  const [extraPartners, setExtraPartners] = useState<ExtraPartner[]>(() => {
    const ids = editing?.score?.partnerIds ?? [];
    const names = editing?.score?.partnerNames ?? [];
    const all: ExtraPartner[] = [];
    for (let i = 0; i < Math.max(ids.length, names.length); i++) {
      const id = ids[i];
      const name = names[i] ?? "";
      if (id) all.push({ id, name });
      else if (name) all.push({ name });
    }
    return all;
  });
  const [newOpponent, setNewOpponent] = useState(editingGhostName);
  const [opponentsLabel, setOpponentsLabel] = useState(editing?.score?.opponentsLabel ?? "");
  const [rating, setRating] = useState<OpponentRating | "">(editing?.score?.rating ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [sets, setSets] = useState<SetScore[]>(editing?.score?.sets ?? [{ me: null, opp: null }]);
  const [customResults, setCustomResults] = useState<CustomGameResult[]>(
    editing?.customResults ?? [],
  );
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    const editScore = editing.score;
    setMode(editing.mode);
    setSurface(editing.surface ?? "");
    setDate(editing.date ?? new Date().toISOString().slice(0, 10));
    setDuration(editing.durationMin != null ? String(editing.durationMin) : "60");
    setShowStartTime(!!editing.startTime);
    setStartTime(editing.startTime ?? "");
    setFormat((editing.formats?.[0] as Format | undefined) ?? "");
    setTrainingFormats(
      editing.mode === "training" && editing.formats?.length ? (editing.formats as Format[]) : [],
    );
    setIsInterclub(editing.isInterclub ?? false);
    setLocation(editing.location ?? "");

    const primaryId = editScore?.partnerId ?? editScore?.opponentId ?? "";
    const ghostName = (() => {
      if (!editScore || primaryId) return "";
      if (editing.formats?.includes("doubles")) return (editScore.partnerName || "").trim();
      return (editScore.partnerName || editScore.opponent || "").trim();
    })();
    setOpponentId(primaryId || (ghostName ? "__new__" : ""));
    setNewOpponent(ghostName);

    const ids = editScore?.partnerIds ?? [];
    const names = editScore?.partnerNames ?? [];
    const extras: ExtraPartner[] = [];
    for (let i = 0; i < Math.max(ids.length, names.length); i++) {
      const id = ids[i];
      const name = names[i] ?? "";
      if (id) extras.push({ id, name });
      else if (name) extras.push({ name });
    }
    setExtraPartners(extras);

    const labels = splitParticipantNames(editScore?.opponentsLabel || editScore?.opponent);
    const trainingIds = editScore?.opponentIds?.length
      ? editScore.opponentIds
      : labels
          .map((name) => players.find((p) => p.name.toLowerCase() === name.toLowerCase())?.id ?? "")
          .filter(Boolean);
    setTrainingOppAId(trainingIds[0] ?? "");
    setTrainingOppBId(trainingIds[1] ?? "");
    setOpponentsLabel(editScore?.opponentsLabel ?? "");
    setRating(editScore?.rating ?? "");
    setNotes(editing.notes ?? "");
    setSets(editScore?.sets ?? [{ me: null, opp: null }]);
    setCustomResults(editing.customResults ?? []);
  }, [editing?.id, players]);

  const opposingTeamRef = useRef<HTMLInputElement>(null);

  const sc = surface ? surfaceClasses[surface] : null;
  // In Training mode, derive flags from the multi-select set; in Match mode, from `format`.
  const isCasual = mode === "training" ? trainingFormats.includes("casual") : format === "casual";
  const isDoubles =
    mode === "training" ? trainingFormats.includes("doubles") : format === "doubles";
  // Casual hides the score grid entirely. In training, "casual" wins if it's selected at all.
  const showScore = !isCasual;
  const isFriendly = mode === "training" && !isCasual;
  const showPartner = true;
  const showRating = mode === "match";
  const locationScrollRef = useRef<HTMLDivElement>(null);

  // If the chosen location has a pre-defined surface, lock the surface picker.
  const lockedSurface: Surface | null = useMemo(() => {
    const trimmed = location.trim().toLowerCase();
    if (!trimmed) return null;
    const saved = savedLocations.find((l) => l.name.toLowerCase() === trimmed);
    if (saved?.defaultSurface && visibleSurfaces.find((s) => s.id === saved.defaultSurface)) {
      return saved.defaultSurface;
    }
    return null;
  }, [location, savedLocations, visibleSurfaces]);

  // Final-set Champions Tiebreak rules:
  //  - Doubles: ALWAYS forced
  //  - Singles: user-toggleable on the final set
  const forceFinalCtb = isDoubles && maxSets >= 3;
  const allowFinalCtbToggle = !isDoubles;

  const visiblePlayers = useMemo(() => players.filter((p) => !p.isArchived), [players]);

  // If a previously-chosen surface becomes hidden, clear it. We do NOT
  // auto-pick a default — surface must be explicitly chosen by the user.
  useEffect(() => {
    if (surface && !visibleSurfaces.find((s) => s.id === surface)) {
      setSurface("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSurfaces.length]);

  // If user switches to Match while "casual" was selected, clear it (Match cannot be casual).
  useEffect(() => {
    if (mode === "match" && format === "casual") setFormat("");
  }, [mode, format]);

  // CRITICAL: Whenever a player is selected, force-sync the rating dropdown
  // to the player's saved classification. This must override any manual value
  // already chosen, so the form stays in sync with the player's profile.
  useEffect(() => {
    if (mode !== "match") return;
    if (opponentId && opponentId !== "__new__") {
      const p = players.find((x) => x.id === opponentId);
      if (p?.classification) {
        setRating(p.classification);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponentId, mode]);

  const selectedPersonName =
    opponentId === "__new__"
      ? newOpponent.trim()
      : (players.find((p) => p.id === opponentId)?.name ?? "");
  const trainingOppAName = players.find((p) => p.id === trainingOppAId)?.name ?? "";
  const trainingOppBName = players.find((p) => p.id === trainingOppBId)?.name ?? "";

  const meLabel = useMeLabel("You");
  const meSide = isDoubles && selectedPersonName ? `${meLabel} & ${selectedPersonName}` : meLabel;

  let oppSide: string;
  if (isDoubles) {
    if (mode === "training") {
      const a = trainingOppAName;
      const b = trainingOppBName;
      oppSide = a && b ? `${a} & ${b}` : a || b || "Opponents";
    } else {
      oppSide = opponentsLabel.trim() || "Opp";
    }
  } else {
    oppSide = selectedPersonName || (mode === "training" ? "Partner" : "Opp");
  }

  // Locations split into favorites vs others, filtered by visibility
  const hiddenSet = useMemo(
    () => new Set(hiddenLocations.map((s) => s.toLowerCase())),
    [hiddenLocations],
  );
  const allLocations = useMemo(() => {
    const seen = new Set<string>();
    const archived = new Set(
      savedLocations.filter((l) => l.isHidden).map((l) => l.name.toLowerCase()),
    );
    const out: { name: string; isFavorite: boolean }[] = [];
    for (const l of savedLocations) {
      const key = l.name.toLowerCase();
      if (seen.has(key)) continue;
      if (hiddenSet.has(key)) continue;
      if (l.isHidden) {
        seen.add(key);
        continue;
      }
      seen.add(key);
      out.push({ name: l.name, isFavorite: !!l.isFavorite });
    }
    for (const s of sessions) {
      const n = s.location?.trim();
      if (!n) continue;
      const key = n.toLowerCase();
      if (seen.has(key)) continue;
      if (hiddenSet.has(key)) continue;
      if (archived.has(key)) continue;
      seen.add(key);
      out.push({ name: n, isFavorite: false });
    }
    return out;
  }, [savedLocations, sessions, hiddenSet]);

  const favoriteLocations = allLocations.filter((l) => l.isFavorite);
  const otherLocations = allLocations.filter((l) => !l.isFavorite);

  function toggleFavoriteLocation(name: string) {
    const existing = savedLocations.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setSavedLocations(
        savedLocations.map((l) => (l.id === existing.id ? { ...l, isFavorite: !l.isFavorite } : l)),
      );
    } else {
      setSavedLocations([
        { id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), isFavorite: true },
        ...savedLocations,
      ]);
    }
  }

  /**
   * Resolve the selected partner. Returns an existing Player when one is
   * selected (or one happens to match a typed name case-insensitively).
   *
   * Ghost-player protection: if the user types a brand new name, we DO NOT
   * add them to the permanent Network — the name is persisted only on the
   * session itself (via score.opponent / score.partnerName).
   */
  function ensurePlayer(): Player | null {
    if (opponentId === "__new__") {
      const n = newOpponent.trim();
      if (!n) return null;
      const existing = players.find((p) => p.name.toLowerCase() === n.toLowerCase());
      return existing ?? null;
    }
    return players.find((p) => p.id === opponentId) ?? null;
  }

  function addCustomResult() {
    if (games.length === 0) return;
    // Prevent duplicate mini-game entries: pick the first game not already in the session.
    const usedIds = new Set(customResults.map((r) => r.gameId));
    const g = games.find((x) => !usedIds.has(x.id));
    if (!g) return;
    const isCum = (g.scoringMode ?? "match") === "cumulative";
    setCustomResults((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        gameId: g.id,
        sets: isCum ? [{ me: null, opp: null }] : [{ me: null, opp: null }],
      },
    ]);
  }

  function updateResult(id: string, patch: Partial<CustomGameResult>) {
    setCustomResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeResult(id: string) {
    setCustomResults((prev) => prev.filter((r) => r.id !== id));
  }

  function addLocationFromInput() {
    const n = location.trim();
    if (!n) return;
    if (savedLocations.some((l) => l.name.toLowerCase() === n.toLowerCase())) return;
    setSavedLocations([
      { id: crypto.randomUUID(), name: n, createdAt: new Date().toISOString() },
      ...savedLocations,
    ]);
  }

  function hasMissingTiebreak(setsToCheck: SetScore[]): boolean {
    return setsToCheck.some((s) => {
      if (s.isCtb) {
        // CTB row must be filled on both sides if the user has started either side.
        const started = s.me != null || s.opp != null;
        return started && (s.me == null || s.opp == null);
      }
      const a = s.me,
        b = s.opp;
      if (a == null || b == null) return false;
      const isTb = (a === 7 && b === 6) || (a === 6 && b === 7);
      if (!isTb) return false;
      // TB scores required AND winner must match set winner.
      if (s.meTb == null || s.oppTb == null) return true;
      const setWinnerIsMe = a > b;
      const tbWinnerIsMe = s.meTb > s.oppTb;
      return setWinnerIsMe !== tbWinnerIsMe;
    });
  }

  // ===== Save-button validity guard =====
  // Required: partner/opponent (when applicable), location, surface,
  // and (when score is shown) a mathematically valid match.
  // Casual training: partner selection is optional. The user can save without one.
  const partnerOptional = mode === "training" && isCasual;
  const partnerOk =
    !showPartner || partnerOptional
      ? true
      : opponentId === "__new__"
        ? newOpponent.trim().length > 0
        : !!opponentId;
  const locationOk = location.trim().length > 0;
  const surfaceOk = !!surface;
  const scoreOk = !showScore
    ? true
    : (() => {
        // At least one set must be filled, and all filled sets must be legal,
        // and any 7-6 set must have a consistent tiebreak.
        const filled = sets.filter((s) => s.me != null && s.opp != null);
        if (filled.length === 0) return false;
        for (const s of sets) {
          if (s.me == null || s.opp == null) continue;
          if (s.isCtb) {
            if (!isLegalChampionsTiebreak(s.me, s.opp)) return false;
          } else if (!isLegalSet(s.me, s.opp)) {
            return false;
          }
          if (!isTiebreakConsistent(s)) return false;
        }
        if (mode === "match" && !isMatchDecided(sets, maxSets)) return false;
        return true;
      })();
  const durationOk = (Number.parseInt(duration, 10) || 0) > 0;
  const formatOk = mode === "training" ? trainingFormats.length > 0 : !!format;
  const canSave = partnerOk && locationOk && surfaceOk && scoreOk && durationOk && formatOk;

  function handleSave() {
    if (!canSave) return;
    try {
      // Block saves with a 7-6 / 6-7 set missing the tiebreak score.
      if (showScore && hasMissingTiebreak(sets)) {
        setAlertMsg(
          "Tiebreak / Super-Tiebreak is missing or inconsistent. The TB winner must match the set winner.",
        );
        return;
      }
      for (const r of customResults) {
        const g = games.find((x) => x.id === r.gameId);
        const isCum = (g?.scoringMode ?? "match") === "cumulative";
        // Cumulative mini-games: skip ALL tiebreak / set-validation logic.
        if (isCum) continue;
        if (hasMissingTiebreak(r.sets)) {
          setAlertMsg("Tiebreak / Super-Tiebreak is missing or inconsistent for a mini-game.");
          return;
        }
      }
      const safeDate = date || new Date().toISOString().slice(0, 10);
      const safeDuration = Number.parseInt(duration, 10) || 0;
      const fallbackFormat: Format = "singles";
      const safeFormats: Format[] =
        mode === "training"
          ? trainingFormats.length > 0
            ? trainingFormats
            : [fallbackFormat]
          : [format || fallbackFormat];

      let player: Player | null = null;
      if (showPartner) {
        try {
          player = ensurePlayer();
        } catch (playerError) {
          console.warn("Player lookup failed during save:", playerError);
        }
      }

      // Ghost-player support: when the user typed a fresh name (opponentId === "__new__"
      // and no existing match), `player` is null but the typed name still belongs on the
      // session record so it shows up in titles, H2H labels, and friendly mirroring.
      const ghostName = opponentId === "__new__" && !player ? newOpponent.trim() : "";
      const partnerDisplayName = player?.name || ghostName || undefined;

      const opponentRating: OpponentRating | undefined = showRating
        ? (rating as OpponentRating) || player?.classification || undefined
        : undefined;

      const trainingOppLabel =
        mode === "training" && isDoubles
          ? [trainingOppAName, trainingOppBName].filter(Boolean).join(" & ")
          : "";

      // Build extras (singles training/casual) — persisted regardless of score.
      const allowExtras = mode === "training" && !isDoubles;
      const cleanExtras = allowExtras
        ? extraPartners
            .map((ep) => {
              if (ep.id && ep.id !== player?.id) {
                const pl = players.find((p) => p.id === ep.id);
                return pl ? { id: pl.id, name: pl.name } : null;
              }
              const n = ep.name.trim();
              if (!n) return null;
              if (player && n.toLowerCase() === player.name.toLowerCase()) return null;
              return { id: undefined, name: n } as { id?: string; name: string };
            })
            .filter((x): x is { id?: string; name: string } => x !== null)
        : [];
      const cleanIds = cleanExtras.map((e) => e!.id).filter((x): x is string => !!x);
      const cleanNames = cleanExtras.map((e) => e!.name);
      const trainingOpponentIds = [trainingOppAId, trainingOppBId].filter(Boolean);

      let rawScore: Score | undefined;
      if (mode === "training" && isDoubles) {
        rawScore = {
          opponentId: undefined,
          opponent: trainingOppLabel || opponentsLabel.trim(),
          opponentsLabel: trainingOppLabel || opponentsLabel.trim() || undefined,
          opponentIds: trainingOpponentIds.length > 0 ? trainingOpponentIds : undefined,
          partnerId: player?.id,
          partnerName: partnerDisplayName,
          sets: showScore ? (sets.length > 0 ? sets : [{ me: null, opp: null }]) : [],
        };
      } else if (mode === "training") {
        rawScore = {
          opponent: "",
          partnerId: player?.id,
          partnerName: partnerDisplayName,
          sets: showScore ? (sets.length > 0 ? sets : [{ me: null, opp: null }]) : [],
          partnerIds: cleanIds.length > 0 ? cleanIds : undefined,
          partnerNames: cleanNames.length > 0 ? cleanNames : undefined,
        };
      } else if (showScore && isDoubles) {
        rawScore = {
          opponentId: undefined,
          opponent: opponentsLabel.trim(),
          opponentsLabel: opponentsLabel.trim() || undefined,
          partnerId: player?.id,
          partnerName: partnerDisplayName,
          rating: opponentRating,
          meRating:
            showRating && myClassification ? (myClassification as OpponentRating) : undefined,
          sets: sets.length > 0 ? sets : [{ me: null, opp: null }],
        };
      } else if (showScore) {
        rawScore = {
          opponentId: player?.id,
          opponent:
            player?.name ?? ghostName ?? players.find((p) => p.id === opponentId)?.name ?? "",
          rating: opponentRating,
          meRating:
            showRating && myClassification ? (myClassification as OpponentRating) : undefined,
          sets: sets.length > 0 ? sets : [{ me: null, opp: null }],
        };
      }

      const trimmedLocation = location.trim();
      if (
        trimmedLocation &&
        !savedLocations.some((l) => l.name.toLowerCase() === trimmedLocation.toLowerCase())
      ) {
        setSavedLocations([
          { id: crypto.randomUUID(), name: trimmedLocation, createdAt: new Date().toISOString() },
          ...savedLocations,
        ]);
      }

      const session: Session = {
        id: editing?.id ?? crypto.randomUUID(),
        date: safeDate,
        startTime: startTime || undefined,
        durationMin: safeDuration,
        surface: (surface || (visibleSurfaces[0]?.id ?? "hard")) as Surface,
        mode,
        formats: safeFormats,
        isFriendly: mode === "training" ? isFriendly : undefined,
        isInterclub: mode === "match" ? isInterclub : undefined,
        location: trimmedLocation || undefined,
        notes: notes.trim() || undefined,
        score: rawScore,
        customResults:
          mode === "training" && customResults.length > 0
            ? customResults.map((result) => ({
                ...result,
                partnerId: result.partnerId ?? player?.id,
                partnerName: result.partnerName ?? partnerDisplayName,
                sets: result.sets.length > 0 ? result.sets : [{ me: null, opp: null }],
              }))
            : undefined,
      };

      const existingRaw =
        typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEYS.sessions) : null;
      const existingSessions = existingRaw ? ((JSON.parse(existingRaw) as Session[]) ?? []) : [];
      const nextSessions = editing
        ? existingSessions.map((item) => (item.id === editing.id ? session : item))
        : [session, ...existingSessions];

      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(nextSessions));
        window.dispatchEvent(
          new CustomEvent("lovable-storage-sync", { detail: { key: STORAGE_KEYS.sessions } }),
        );
      }

      setSessions(nextSessions);
      onSaved();
    } catch (err) {
      console.error("Failed to save session:", err);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Sticky header with save action */}
      <div className="flex items-center justify-between sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/90 backdrop-blur">
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="size-10 rounded-full bg-card border border-border flex items-center justify-center hover:border-foreground/40"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          )}
          <h2 className="text-2xl font-bold">{editing ? "Edit Session" : "New Session"}</h2>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={cn(
            "size-11 rounded-full bg-optic text-primary-foreground flex items-center justify-center hover:brightness-110 transition",
            !canSave && "opacity-30 cursor-not-allowed hover:brightness-100",
          )}
          aria-label="Save session"
        >
          <Check className="size-6" strokeWidth={3} />
        </button>
      </div>

      {/* 1. Type — animated sliding pill + IC toggle */}
      <div className="flex items-stretch gap-2">
        <div className="flex-1">
          <AnimatedTabs
            value={mode}
            onChange={(v) => setMode(v as SessionMode)}
            tabs={[
              { id: "match", label: "Match" },
              { id: "training", label: "Training" },
            ]}
          />
        </div>
        <button
          type="button"
          onClick={() => setIsInterclub((v) => !v)}
          disabled={mode !== "match"}
          aria-pressed={isInterclub}
          aria-label="Interclub match"
          className={cn(
            "shrink-0 px-3 rounded-full border-2 text-xs font-black tracking-widest transition-all flex items-center justify-center min-w-[52px]",
            mode !== "match" && "opacity-30 cursor-not-allowed",
            isInterclub && mode === "match"
              ? "bg-[var(--ic-purple)] border-[var(--ic-purple)] text-white"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          IC
        </button>
      </div>

      {/* 2. Location — favorites + dropdown for the rest */}
      <Section title="Location" tight>
        <div
          ref={locationScrollRef}
          className="flex flex-row gap-2 overflow-x-auto whitespace-nowrap pb-1 scrollbar-none -mx-1 px-1 items-center"
        >
          <button
            type="button"
            onClick={() => setShowLocationInput((v) => !v)}
            className={cn(
              "shrink-0 px-3 py-2.5 rounded-2xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-1",
              showLocationInput
                ? "border-optic text-optic bg-optic/10"
                : "border-dashed border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Plus className="size-3" /> New
          </button>
          {favoriteLocations.map(({ name, isFavorite }) => {
            const active = location === name;
            return (
              <button
                type="button"
                data-loc-name={name}
                key={name}
                onClick={(e) => {
                  if (active) {
                    setLocation("");
                    return;
                  }
                  setLocation(name);
                  setShowLocationInput(false);
                  const saved = savedLocations.find(
                    (l) => l.name.toLowerCase() === name.toLowerCase(),
                  );
                  if (
                    saved?.defaultSurface &&
                    visibleSurfaces.find((s) => s.id === saved.defaultSurface)
                  ) {
                    setSurface(saved.defaultSurface);
                  }
                  const container = locationScrollRef.current;
                  const btn = e.currentTarget;
                  if (container && btn) {
                    const target = btn.offsetLeft - container.offsetLeft;
                    container.scrollTo({ left: target, behavior: "smooth" });
                  }
                }}
                className={cn(
                  "shrink-0 px-3 py-2.5 rounded-2xl border-2 text-xs font-medium transition-all truncate flex items-center gap-1.5 max-w-[160px]",
                  active
                    ? "border-optic bg-optic/10 text-optic"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {isFavorite && <Star className="size-3 fill-current text-optic shrink-0" />}
                <span className="truncate">{name}</span>
              </button>
            );
          })}
          {/* Show currently-selected non-favorite location as a pill so it's visible */}
          {location &&
            !favoriteLocations.some((l) => l.name === location) &&
            otherLocations.some((l) => l.name === location) && (
              <button
                type="button"
                onClick={() => setLocation("")}
                className="shrink-0 px-3 py-2.5 rounded-2xl border-2 border-optic bg-optic/10 text-optic text-xs font-medium truncate max-w-[160px]"
              >
                <span className="truncate">{location}</span>
              </button>
            )}
          {otherLocations.length > 0 && (
            <div className="shrink-0 relative">
              <select
                value=""
                onChange={(e) => {
                  const name = e.target.value;
                  if (!name) return;
                  setLocation(name);
                  setShowLocationInput(false);
                  const saved = savedLocations.find(
                    (l) => l.name.toLowerCase() === name.toLowerCase(),
                  );
                  if (
                    saved?.defaultSurface &&
                    visibleSurfaces.find((s) => s.id === saved.defaultSurface)
                  ) {
                    setSurface(saved.defaultSurface);
                  }
                }}
                className="appearance-none px-3 pr-7 py-2.5 rounded-2xl border-2 border-border text-xs font-bold text-muted-foreground hover:text-foreground bg-card focus:outline-none cursor-pointer"
                aria-label="More locations"
              >
                <option value="">More…</option>
                {otherLocations.map(({ name }) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <ChevronDown className="size-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>
        {showLocationInput && (
          <div className="flex gap-1.5 mt-2">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={addLocationFromInput}
              placeholder="Add a Location"
              className={cn(inputClass, "py-2 text-sm")}
              autoFocus
            />
            {location && (
              <button
                type="button"
                onClick={() => setLocation("")}
                className="size-10 rounded-xl border-2 border-border text-muted-foreground hover:text-destructive hover:border-destructive flex items-center justify-center shrink-0"
                aria-label="Clear location"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </Section>

      {/* 3. Surface */}
      <Section title="Surface" tight>
        <div className="flex flex-row gap-2 overflow-x-auto whitespace-nowrap pb-1 scrollbar-none -mx-1 px-1">
          {visibleSurfaces.map((s) => {
            const active = surface === s.id;
            const ssc = surfaceClasses[s.id];
            return (
              <button
                type="button"
                key={s.id}
                disabled={!!lockedSurface && lockedSurface !== s.id}
                onClick={() => {
                  if (lockedSurface) return;
                  setSurface(s.id);
                }}
                className={cn(
                  "shrink-0 px-3 py-2 rounded-full border-2 text-xs font-bold transition-all flex items-center gap-1.5",
                  active
                    ? `${ssc.border} ${ssc.bgSoft} text-foreground`
                    : "border-border text-muted-foreground hover:text-foreground",
                  !!lockedSurface && lockedSurface !== s.id && "opacity-30 cursor-not-allowed",
                  !!lockedSurface && lockedSurface === s.id && "cursor-default",
                )}
                aria-disabled={!!lockedSurface && lockedSurface !== s.id}
                title={lockedSurface ? "Locked by location's default surface" : undefined}
              >
                <span className={cn("size-2.5 rounded-full shrink-0", ssc.dot)} />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* 4. Date / Duration / optional Start Time */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Duration (min)">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={duration}
              onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
              placeholder="0"
              className={cn(inputClass, "tabular-nums")}
            />
          </Field>
        </div>
        {showStartTime ? (
          <Field label="Start Time">
            <div className="flex gap-2 items-center">
              <Clock className="size-4 text-muted-foreground shrink-0" />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  setShowStartTime(false);
                  setStartTime("");
                }}
                className="size-12 rounded-xl border-2 border-border text-muted-foreground hover:text-destructive hover:border-destructive flex items-center justify-center shrink-0"
                aria-label="Remove start time"
              >
                <X className="size-4" />
              </button>
            </div>
          </Field>
        ) : (
          <button
            type="button"
            onClick={() => setShowStartTime(true)}
            className="self-start text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-optic transition flex items-center gap-1.5"
          >
            <Plus className="size-3" /> <Clock className="size-3" /> Add start time
          </button>
        )}
      </div>

      {/* 5. Format — Match: single-select [Singles | Doubles]. Training: multi-select [Singles | Doubles | Casual]. */}
      <Section title="Format">
        <div className="flex gap-2">
          {(mode === "match"
            ? (["singles", "doubles"] as Format[])
            : (["singles", "doubles", "casual"] as Format[])
          ).map((f) => {
            const active = mode === "training" ? trainingFormats.includes(f) : format === f;
            return (
              <button
                type="button"
                key={f}
                onClick={() => {
                  if (mode === "training") {
                    setTrainingFormats((prev) =>
                      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
                    );
                  } else {
                    setFormat(f);
                  }
                }}
                aria-pressed={active}
                className={cn(
                  "flex-1 px-3 py-2.5 rounded-full border-2 text-sm font-medium transition-all",
                  active
                    ? "border-optic bg-optic/10 text-optic"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {formatLabel[f]}
              </button>
            );
          })}
        </div>
      </Section>

      {/* 6. Person picker + Rating — in-place selection */}
      {showPartner && (
        <Section
          title={
            mode === "match" ? (isDoubles ? "Partner & Rating" : "Opponent & Rating") : "Partner"
          }
        >
          <div className={cn("grid gap-2", showRating ? "grid-cols-[1fr_110px]" : "grid-cols-1")}>
            <InPlacePlayerPicker
              players={visiblePlayers}
              value={opponentId}
              newName={newOpponent}
              onChangeNewName={setNewOpponent}
              onChange={(id) => {
                setOpponentId(id);
                if (id !== "__new__") setNewOpponent("");
              }}
              placeholder={
                mode === "match" ? (isDoubles ? "Add a Partner" : "Opponents") : "Add a Partner"
              }
              inputClass={inputClass}
            />
            {showRating && (
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value as OpponentRating | "")}
                className={cn(inputClass, "tabular-nums font-bold text-center")}
                aria-label="Opponent rating"
              >
                <option value="">R-</option>
                {OPPONENT_RATINGS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}
          </div>

          {mode === "training" && !isDoubles && (
            <div className="flex flex-col gap-2 mt-2">
              {extraPartners.map((ep, idx) => {
                const taken = new Set<string>([
                  opponentId,
                  ...extraPartners
                    .filter((_, i) => i !== idx)
                    .map((x) => x.id ?? "")
                    .filter(Boolean),
                ]);
                const availablePlayers = visiblePlayers.filter(
                  (p) => !taken.has(p.id) || p.id === ep.id,
                );
                const pickerValue = ep.id ? ep.id : ep.name ? "__new__" : "";
                return (
                  <div key={idx} className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <InPlacePlayerPicker
                        players={availablePlayers}
                        value={pickerValue}
                        newName={ep.id ? "" : ep.name}
                        onChangeNewName={(v) =>
                          setExtraPartners((prev) =>
                            prev.map((x, i) => (i === idx ? { id: undefined, name: v } : x)),
                          )
                        }
                        onChange={(v) => {
                          if (v === "__new__") {
                            setExtraPartners((prev) =>
                              prev.map((x, i) => (i === idx ? { id: undefined, name: "" } : x)),
                            );
                            return;
                          }
                          if (!v) {
                            setExtraPartners((prev) =>
                              prev.map((x, i) => (i === idx ? { id: undefined, name: "" } : x)),
                            );
                            return;
                          }
                          const pl = visiblePlayers.find((p) => p.id === v);
                          setExtraPartners((prev) =>
                            prev.map((x, i) => (i === idx ? { id: v, name: pl?.name ?? "" } : x)),
                          );
                        }}
                        placeholder="Add a Partner"
                        inputClass={inputClass}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setExtraPartners((prev) => prev.filter((_, i) => i !== idx))}
                      className="size-11 rounded-xl border-2 border-border text-muted-foreground hover:text-destructive hover:border-destructive transition flex items-center justify-center shrink-0"
                      aria-label="Remove partner"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setExtraPartners((prev) => [...prev, { id: undefined, name: "" }])}
                className="self-start text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-1.5"
              >
                <Plus className="size-3.5" /> Add another partner
              </button>
            </div>
          )}
        </Section>
      )}

      {/* 6b. Doubles-training: pick the two opponents (3-person picker total) */}
      {mode === "training" && isDoubles && (
        <Section title="Opponents (Doubles)">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={trainingOppAId}
              onChange={(e) => setTrainingOppAId(e.target.value)}
              className={inputClass}
              aria-label="Opponent 1"
            >
              <option value="">Opponent 1</option>
              {visiblePlayers
                .filter((p) => p.id !== opponentId && p.id !== trainingOppBId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <select
              value={trainingOppBId}
              onChange={(e) => setTrainingOppBId(e.target.value)}
              className={inputClass}
              aria-label="Opponent 2"
            >
              <option value="">Opponent 2</option>
              {visiblePlayers
                .filter((p) => p.id !== opponentId && p.id !== trainingOppAId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
        </Section>
      )}

      {showScore && (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-foreground">
            RESULT
          </div>
          <ScoreGrid
            meName={meSide}
            oppName={oppSide}
            sets={sets}
            onChange={setSets}
            accentClass={sc?.border ?? ""}
            accentText={sc?.text ?? ""}
            maxSets={maxSets}
            forceFinalCtb={forceFinalCtb}
            allowFinalCtbToggle={allowFinalCtbToggle}
            colorScheme={mode === "training" ? "training" : "match"}
            strictBestOf={mode === "match"}
          />
          {/* Doubles match: free-text opposing team label, BELOW the grid */}
          {mode === "match" && isDoubles && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Name der Gegner (optional)
              </label>
              <input
                ref={opposingTeamRef}
                value={opponentsLabel}
                onChange={(e) => setOpponentsLabel(e.target.value)}
                onFocus={() => {
                  setTimeout(() => {
                    opposingTeamRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }, 200);
                }}
                placeholder="Opponents"
                className={inputClass}
              />
            </div>
          )}
        </div>
      )}

      {/* 8. Mini-games (training only) */}
      {mode === "training" && (
        <Section title="Mini-Games">
          <div className="flex flex-col gap-3">
            {customResults.map((r) => {
              const g = games.find((x) => x.id === r.gameId);
              const isCum = (g?.scoringMode ?? "match") === "cumulative";
              // Hide games already used by OTHER rows (keep this row's current gameId visible).
              const usedElsewhere = new Set(
                customResults.filter((x) => x.id !== r.id).map((x) => x.gameId),
              );
              const availableGames = games.filter((gg) => !usedElsewhere.has(gg.id));
              const maxRows = isCum ? cumulativeMaxSets : maxSets;
              const partnerLabel = selectedPersonName || "Partner";
              return (
                <div
                  key={r.id}
                  className="bg-card border border-border rounded-2xl p-3 flex flex-col gap-2.5"
                >
                  <div className="flex items-center gap-2">
                    <select
                      value={r.gameId}
                      onChange={(e) => updateResult(r.id, { gameId: e.target.value })}
                      className="flex-1 bg-background border-2 border-border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-optic"
                    >
                      {availableGames.map((gg) => (
                        <option key={gg.id} value={gg.id}>
                          {gg.name} {(gg.scoringMode ?? "match") === "cumulative" ? "· Σ" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeResult(r.id)}
                      className="size-9 rounded-full bg-muted text-muted-foreground hover:text-destructive flex items-center justify-center shrink-0"
                      aria-label="Remove"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr_36px] items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span className="truncate text-center">{meLabel}</span>
                    <span className="w-3" />
                    <span className="truncate text-center">{partnerLabel}</span>
                    <span />
                  </div>
                  {r.sets.map((set, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[1fr_auto_1fr_36px] items-center gap-1.5"
                    >
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={set.me ?? ""}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "");
                          const next = [...r.sets];
                          next[idx] = { ...next[idx], me: v === "" ? null : Number(v) };
                          updateResult(r.id, { sets: next });
                        }}
                        placeholder="0"
                        className={cn(inputClass, "py-2 text-center tabular-nums font-bold")}
                      />
                      <span className="text-muted-foreground font-bold w-3 text-center">:</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={set.opp ?? ""}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "");
                          const next = [...r.sets];
                          next[idx] = { ...next[idx], opp: v === "" ? null : Number(v) };
                          updateResult(r.id, { sets: next });
                        }}
                        placeholder="0"
                        className={cn(inputClass, "py-2 text-center tabular-nums font-bold")}
                      />
                      {r.sets.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => {
                            const next = r.sets.filter((_, i) => i !== idx);
                            updateResult(r.id, {
                              sets: next.length > 0 ? next : [{ me: null, opp: null }],
                            });
                          }}
                          className="size-9 rounded-lg border-2 border-border text-muted-foreground hover:text-destructive hover:border-destructive flex items-center justify-center"
                          aria-label="Remove set"
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                  {r.sets.length < maxRows && (
                    <button
                      type="button"
                      onClick={() =>
                        updateResult(r.id, { sets: [...r.sets, { me: null, opp: null }] })
                      }
                      className="self-start text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-optic flex items-center gap-1.5"
                    >
                      <Plus className="size-3.5" /> Add set
                    </button>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={addCustomResult}
              disabled={games.length === 0 || customResults.length >= games.length}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:text-optic hover:border-optic transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="size-4" /> Add Mini-Game Result
            </button>
            {games.length === 0 && (
              <div className="text-[11px] text-muted-foreground text-center">
                Create a mini-game in the Games tab to attach results.
              </div>
            )}
          </div>
        </Section>
      )}

      {/* 9. (Skip-score removed — use the "Casual" chip in the Format row instead.) */}

      {/* Notes */}
      <Field label="Notes">
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Conditions, focus, takeaways…"
          className={cn(inputClass, "resize-none")}
        />
      </Field>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-2xl border-2 border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={cn(
            "flex-[2] py-3.5 rounded-2xl bg-optic text-primary-foreground font-bold text-base transition hover:brightness-110",
            !canSave && "opacity-30 cursor-not-allowed hover:brightness-100",
          )}
        >
          {editing ? "Update Session" : "Save Session"}
        </button>
      </div>
      <AlertModal
        open={!!alertMsg}
        title="Score incomplete"
        description={alertMsg ?? ""}
        onClose={() => setAlertMsg(null)}
      />
    </div>
  );
}

function Section({
  title,
  children,
  tight = false,
}: {
  title: string;
  children: React.ReactNode;
  tight?: boolean;
}) {
  return (
    <div className={cn("flex flex-col", tight ? "gap-1" : "gap-2")}>
      <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * In-place player picker:
 *  - Empty: shows native select with all players + "+ New".
 *  - Selected: shows player name as a chip with a chevron to revert/change.
 *  - "__new__": shows text input with X to revert.
 */
function InPlacePlayerPicker({
  players,
  value,
  newName,
  onChange,
  onChangeNewName,
  placeholder,
  inputClass,
}: {
  players: Player[];
  value: string;
  newName: string;
  onChange: (id: string) => void;
  onChangeNewName: (v: string) => void;
  placeholder: string;
  inputClass: string;
}) {
  const selected = value && value !== "__new__" ? players.find((p) => p.id === value) : null;

  if (selected) {
    return (
      <button
        type="button"
        onClick={() => onChange("")}
        className={cn(
          inputClass,
          "flex items-center justify-between gap-2 text-left cursor-pointer hover:border-foreground/40",
        )}
        aria-label={`Change selection (currently ${selected.name})`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="size-7 rounded-full bg-graphite flex items-center justify-center text-xs font-bold shrink-0">
            {selected.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate font-semibold">{selected.name}</span>
          {selected.classification && (
            <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full bg-graphite/70">
              {selected.classification}
            </span>
          )}
        </span>
        <ChevronDown className="size-4 text-muted-foreground shrink-0" />
      </button>
    );
  }

  if (value === "__new__") {
    return (
      <div className="flex gap-1.5">
        <input
          autoFocus
          value={newName}
          onChange={(e) => onChangeNewName(e.target.value)}
          placeholder={placeholder}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => {
            onChange("");
            onChangeNewName("");
          }}
          className="size-12 rounded-xl border-2 border-border text-muted-foreground hover:text-destructive hover:border-destructive flex items-center justify-center shrink-0"
          aria-label="Cancel new player"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
      aria-label={placeholder}
    >
      <option value="">{placeholder}</option>
      {players.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
      <option value="__new__">+ Add new player…</option>
    </select>
  );
}
