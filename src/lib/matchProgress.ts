import type { SetScore } from "./types";

/**
 * Compute current "sets won" by each side from completed sets.
 * A set is "completed" when both me/opp are filled and unequal.
 */
export function setsWon(sets: SetScore[]): { me: number; opp: number; played: number } {
  let me = 0,
    opp = 0,
    played = 0;
  for (const s of sets) {
    if (s.me == null || s.opp == null) continue;
    if (s.me === s.opp) continue;
    played++;
    if (s.me > s.opp) me++;
    else opp++;
  }
  return { me, opp, played };
}

/**
 * Returns true if the match is mathematically decided in a Best-of-N format.
 * (E.g. Bo3 → 2 sets won; Bo5 → 3 sets won.)
 */
export function isMatchDecided(sets: SetScore[], maxSets: number): boolean {
  if (maxSets <= 0) return false;
  const needed = Math.floor(maxSets / 2) + 1;
  const { me, opp } = setsWon(sets);
  return me >= needed || opp >= needed;
}
