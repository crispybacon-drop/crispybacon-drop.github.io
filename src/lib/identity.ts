import { useLocalStorage, STORAGE_KEYS } from "./storage";
import type { OpponentRating } from "./types";

/**
 * Local-only user identity (Name + Rating). Stored exclusively in localStorage.
 * The Name replaces the generic "Me" label across the app (Stats, Network,
 * Session lists, charts). The SessionForm intentionally uses "You" instead.
 */
export function useUserName() {
  return useLocalStorage<string>(STORAGE_KEYS.userName, "");
}

export function useUserRating() {
  return useLocalStorage<OpponentRating | "">(STORAGE_KEYS.userRating, "");
}

/** Convenience: name to display on the "Me" side, with safe fallback. */
export function useMeLabel(fallback = "Me"): string {
  const [name] = useUserName();
  return name.trim() || fallback;
}
