import { useLocalStorage, STORAGE_KEYS } from "./storage";
import type { Surface } from "./types";

/** Default surface for new sessions. */
export function useDefaultSurface() {
  return useLocalStorage<Surface>(STORAGE_KEYS.defaultSurface, "carpet");
}

export type MaxSets = 1 | 3 | 5;
export function useMaxSets() {
  return useLocalStorage<MaxSets>(STORAGE_KEYS.maxSets, 3);
}

/** Max number of "rounds" (rows) for cumulative mini-games (separate from match max sets). */
export type CumulativeMaxSets = 1 | 2 | 3;
export function useCumulativeMaxSets() {
  return useLocalStorage<CumulativeMaxSets>(STORAGE_KEYS.cumulativeMaxSets, 3);
}

/** Hidden location names (lowercased). */
export function useLocationVisibility() {
  return useLocalStorage<string[]>(STORAGE_KEYS.locationVisibility, []);
}

/** Default layout for the All Sessions list. */
export type DefaultSessionsView = "list" | "grid";
export function useDefaultSessionsView() {
  return useLocalStorage<DefaultSessionsView>(STORAGE_KEYS.defaultSessionsView, "grid");
}

/** Force champions tiebreak in the last set when playing doubles. */
export function useForcedDoublesCtbLastSet() {
  return useLocalStorage<boolean>(STORAGE_KEYS.forcedDoublesCtbLastSet, true);
}
