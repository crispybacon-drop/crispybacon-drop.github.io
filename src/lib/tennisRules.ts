import type { SetScore } from "./types";

/**
 * Validate a regular tennis set:
 *   6:0..6:4, 7:5, 7:6 (and inverse)
 * Returns true while the user is mid-typing (any partial), false only when both
 * values are filled AND the combination is illegal.
 */
export function isLegalSet(me: number | null | undefined, opp: number | null | undefined): boolean {
  if (me == null || opp == null) return true; // partial entry — allow
  if (me < 0 || opp < 0 || me > 7 || opp > 7) return false;
  if (me === opp) return false;
  const hi = Math.max(me, opp);
  const lo = Math.min(me, opp);
  if (hi === 6 && lo <= 4) return true;
  if (hi === 7 && (lo === 5 || lo === 6)) return true;
  return false;
}

/**
 * Validate a Champions Tiebreak (CTB) result:
 *   first to 10, win by 2. Common: 10:0..10:8, 11:9, 12:10, etc.
 */
export function isLegalChampionsTiebreak(me: number | null | undefined, opp: number | null | undefined): boolean {
  if (me == null || opp == null) return true;
  if (me < 0 || opp < 0) return false;
  if (me === opp) return false;
  const hi = Math.max(me, opp);
  const lo = Math.min(me, opp);
  if (hi < 10) return false;
  if (hi === 10) return lo <= 8;
  return hi - lo === 2;
}

/**
 * Validate a normal-set tiebreak (first to 7, win by 2). Partial entry allowed.
 */
export function isLegalTiebreak(me: number | null | undefined, opp: number | null | undefined): boolean {
  if (me == null || opp == null) return true;
  if (me < 0 || opp < 0) return false;
  if (me === opp) return false;
  const hi = Math.max(me, opp);
  const lo = Math.min(me, opp);
  if (hi < 7) return false;
  if (hi === 7) return lo <= 5;
  return hi - lo === 2;
}

/**
 * The TB winner MUST be the same side that won the 7-6 set. Returns true while
 * either value is empty (mid-entry); false only when both filled and inconsistent
 * (or the TB itself is illegal).
 */
export function isTiebreakConsistent(set: SetScore): boolean {
  if (set.isCtb) return true;
  const a = set.me, b = set.opp;
  if (a == null || b == null) return true;
  const isTb = (a === 7 && b === 6) || (a === 6 && b === 7);
  if (!isTb) return true;
  const ta = set.meTb, tb = set.oppTb;
  if (ta == null || tb == null) return true; // mid-typing
  if (!isLegalTiebreak(ta, tb)) return false;
  const setWinnerIsMe = a > b;
  const tbWinnerIsMe = ta > tb;
  return setWinnerIsMe === tbWinnerIsMe;
}

/** True when this set is a CTB (final-set tiebreak) per session rules. */
export function isCtbSet(set: SetScore): boolean {
  return !!set.isCtb;
}
