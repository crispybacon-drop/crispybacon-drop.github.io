export type Surface = "carpet" | "clay" | "hard";
export type SessionMode = "match" | "training";
export type Format = "singles" | "doubles" | "casual";

export interface SetScore {
  me: number | null;
  opp: number | null;
  meTb?: number | null;
  oppTb?: number | null;
  /** True if this set is a Champions Tiebreak (final-set CTB). */
  isCtb?: boolean;
}

export type OpponentRating = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8" | "R9";

export const OPPONENT_RATINGS: OpponentRating[] = ["R9","R8","R7","R6","R5","R4","R3","R2","R1"];

export interface Score {
  // Singles: opponentId/opponent = the opponent.
  // Doubles: opponentId/opponent stays empty; partnerId/partnerName = your teammate,
  // and opponentsLabel is free-text describing the opposing team (e.g. "Tom & Jerry").
  opponentId?: string;
  opponent: string; // display name (kept for legacy / singles)
  rating?: OpponentRating;
  /** Snapshot of your own classification at the time of the match (does not retro-update). */
  meRating?: OpponentRating;
  sets: SetScore[];
  /** Doubles: your teammate (Player.id). */
  partnerId?: string;
  /** Doubles: teammate display name (fallback when partnerId is missing). */
  partnerName?: string;
  /** Doubles: free-text label for the opposing team. Not linked to Player records. */
  opponentsLabel?: string;
  /** Singles training: additional partner Player.ids beyond the primary one (rotating hitting groups). */
  partnerIds?: string[];
  /** Singles training: extra partner display names aligned with partnerIds. */
  partnerNames?: string[];
}

export interface CustomGameResult {
  id: string;
  gameId: string; // CustomGame.id
  sets: SetScore[]; // same UI as match score
  /** Partner the mini-game was played against (Player.id). Required for H2H stats. */
  partnerId?: string;
  /** Display name fallback when partnerId is missing/legacy. */
  partnerName?: string;
}

export interface Session {
  id: string;
  date: string; // ISO yyyy-mm-dd
  /** Optional 24h "HH:MM" start time. */
  startTime?: string;
  durationMin: number;
  surface: Surface;
  mode: SessionMode;
  formats: Format[];
  isFriendly?: boolean;
  /** Match flag: official Interclub match (vs casual/friendly). */
  isInterclub?: boolean;
  location?: string;
  notes?: string;
  score?: Score;
  customResults?: CustomGameResult[];
}

export interface Player {
  id: string;
  name: string;
  createdAt: string;
  /** Archived players are hidden from new-session pickers but kept for historical stats. */
  isArchived?: boolean;
  /** Optional R1-R9 classification used to auto-fill match snapshot ratings. */
  classification?: OpponentRating;
  /** Manual sort order (lower = earlier). */
  order?: number;
  /** Starred players appear at the top of pickers and lists. */
  isFavorite?: boolean;
  /** Base64 (data URL) avatar image stored locally. Optional. */
  avatarDataUrl?: string;
}

export interface SavedLocation {
  id: string;
  name: string;
  createdAt: string;
  /** Starred locations are shown by default (collapsed) in the new-session picker. */
  isFavorite?: boolean;
  /** Hide from new-session pickers when false. */
  isHidden?: boolean;
  /** Manual sort order (lower = earlier). */
  order?: number;
  /** Optional default surface — auto-selected in SessionForm when this location is picked. */
  defaultSurface?: Surface;
  /** Base64 (data URL) cover image stored locally. Optional. */
  imageDataUrl?: string;
  /** Object-position offset for the cover image, in percentages (0-100). Defaults to 50/50 (center). */
  imageOffsetX?: number;
  imageOffsetY?: number;
}

/** Doubles training: opponents stored as a 2-name slot. */
export interface TrainingDoublesOpponents {
  /** Player.id of the first opponent (required for Network-only enforcement). */
  oppAId?: string;
  /** Player.id of the second opponent. */
  oppBId?: string;
}

// A "Custom Mini-Game" definition (e.g. "Volley Drill"). Played within sessions.
export type GameScoringMode = "match" | "cumulative";

export interface CustomGame {
  id: string;
  name: string;
  createdAt: string;
  /** "match" = win/loss/draw per set; "cumulative" = sums numeric values. Defaults to "match". */
  scoringMode?: GameScoringMode;
  /** Manual sort order (lower = earlier). */
  order?: number;
}

export const SURFACES: { id: Surface; label: string; dotClass: string }[] = [
  { id: "carpet", label: "Carpet", dotClass: "bg-surface-carpet" },
  { id: "clay", label: "Clay", dotClass: "bg-surface-clay" },
  { id: "hard", label: "Hard", dotClass: "bg-surface-hard" },
];

// ===== Legacy types (kept so old localStorage data doesn't break compile) =====
export type ScoringType = "points" | "sets" | "numeric";
export interface Tracker {
  id: string;
  title: string;
  players: string[];
  scoringType: ScoringType;
  values: Record<string, number>;
  setHistory?: SetScore[];
  linkedSessionIds?: string[];
  createdAt: string;
}
