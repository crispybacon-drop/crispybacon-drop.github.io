import type { Format, Session } from "./types";

/**
 * Dynamic session title used across feed, last-session widget, etc.
 *
 * Rules:
 *  - Training w/ partner   → "Training with [Name]"
 *  - Training solo         → "[Singles/Doubles] Session"
 *  - Doubles match w/ partner → "Double with [Name]"
 *  - Match w/ opponent     → "Match vs [Name]"
 *  - Match w/ location only → "Match in [Location]"
 *  - Match default         → "Match"
 */
export function sessionTitle(s: Session): string {
  const score = s.score;
  const partnerName = score?.partnerName?.trim();
  const opponentName = score?.opponent?.trim();
  const opposingTeam = score?.opponentsLabel?.trim();
  const isDoubles = (s.formats ?? []).includes("doubles" as Format);

  if (s.mode === "training") {
    const name = partnerName || opponentName;
    if (name) return `Session with ${name}`;
    const fmt = isDoubles ? "Double" : "Single";
    return `${fmt} Session`;
  }

  // Match — append ONLY opponent classification (never user's own).
  const opp = score?.rating;
  const ratingSuffix = opp ? ` (${opp})` : "";

  if (isDoubles) {
    if (partnerName && opposingTeam) return `Double Match vs ${opposingTeam} (with ${partnerName})${ratingSuffix}`;
    if (opposingTeam) return `Double Match vs ${opposingTeam}${ratingSuffix}`;
    if (partnerName) return `Double Match with ${partnerName}${ratingSuffix}`;
    return `Double Match${ratingSuffix}`;
  }
  if (opponentName) {
    return `Single Match vs ${opponentName}${ratingSuffix}`;
  }
  if (s.location?.trim()) {
    return `Single Match in ${s.location.trim()}`;
  }
  return "Single Match";
}

/** Display name used on the "ME" side of score grids. */
export function meSideLabel(s: { mode: string; formats: Format[]; score?: { partnerName?: string } }): string {
  const isDoubles = (s.formats ?? []).includes("doubles" as Format);
  const partner = s.score?.partnerName?.trim();
  if (isDoubles && partner) return `Me & ${partner}`;
  return "Me";
}

/** Display name used on the opposite side of score grids. */
export function oppSideLabel(s: { mode: string; formats: Format[]; score?: { opponent?: string; opponentsLabel?: string } }): string {
  const isDoubles = (s.formats ?? []).includes("doubles" as Format);
  if (isDoubles) {
    return s.score?.opponentsLabel?.trim() || "Opp";
  }
  return s.score?.opponent?.trim() || "Opp";
}
