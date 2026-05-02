import type { CustomGame, CustomGameResult, Session } from "./types";

/**
 * Hidden auto-managed mini-game ID used for the "Friendly Match" automation:
 * any TRAINING session that has a score is mirrored as a virtual result of
 * this game so it appears in mini-game standings, H2H, and player W/L.
 *
 * This game is never persisted to localStorage — it's projected on the fly.
 */
export const FRIENDLY_GAME_ID = "__virtual_friendly__";

export const FRIENDLY_GAME: CustomGame = {
  id: FRIENDLY_GAME_ID,
  name: "Friendly Match",
  createdAt: "1970-01-01T00:00:00.000Z",
  scoringMode: "match",
  order: -1,
};

export interface FriendlyProjection {
  sessionId: string;
  date: string;
  partnerName?: string;
  result: CustomGameResult;
}

/**
 * Project all TRAINING sessions that have a score as virtual results of the
 * "Friendly Match" mini-game. Match-mode sessions (Interclub or otherwise)
 * are NOT included — those remain in the Match flow.
 */
export function projectFriendlyResults(sessions: Session[]): FriendlyProjection[] {
  const out: FriendlyProjection[] = [];
  for (const s of sessions) {
    if (s.mode !== "training") continue;
    if (!s.score || !s.score.sets || s.score.sets.length === 0) continue;
    // Require at least one filled set so an empty placeholder doesn't count.
    const hasAnyScore = s.score.sets.some((set) => set.me != null || set.opp != null);
    if (!hasAnyScore) continue;

    const partnerName =
      s.score.partnerName ||
      s.score.opponent ||
      s.score.opponentsLabel ||
      undefined;

    out.push({
      sessionId: s.id,
      date: s.date,
      partnerName,
      result: {
        id: `${s.id}-friendly`,
        gameId: FRIENDLY_GAME_ID,
        sets: s.score.sets,
        partnerId: s.score.partnerId ?? s.score.opponentId,
        partnerName,
      },
    });
  }
  return out;
}

/**
 * Merge virtual Friendly Match results into the session.customResults stream
 * so existing aggregation code (StatsPanel, PlayersPanel, dashboard) picks
 * them up without per-call-site changes.
 */
export function withFriendlyResults(sessions: Session[]): Session[] {
  const projections = projectFriendlyResults(sessions);
  if (projections.length === 0) return sessions;
  const bySession = new Map<string, CustomGameResult[]>();
  for (const p of projections) {
    const arr = bySession.get(p.sessionId) ?? [];
    arr.push(p.result);
    bySession.set(p.sessionId, arr);
  }
  return sessions.map((s) => {
    const extra = bySession.get(s.id);
    if (!extra) return s;
    return {
      ...s,
      customResults: [...(s.customResults ?? []), ...extra],
    };
  });
}

/** Inject the virtual Friendly Match game into a list of mini-games (for display/aggregation). */
export function withFriendlyGame(games: CustomGame[]): CustomGame[] {
  return [FRIENDLY_GAME, ...games];
}
