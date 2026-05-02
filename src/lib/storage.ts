import { useEffect, useState, useCallback } from "react";

const EVENT = "lovable-storage-sync";

function readValue<T>(key: string, initial: T): T {
  if (typeof window === "undefined") return initial;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : initial;
  } catch {
    return initial;
  }
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  // Hydrate from localStorage on mount (avoid SSR mismatch)
  useEffect(() => {
    setValue(readValue(key, initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Listen for cross-instance updates
  useEffect(() => {
    function onSync(e: Event) {
      const detail = (e as CustomEvent).detail as { key: string } | undefined;
      if (!detail || detail.key !== key) return;
      setValue(readValue(key, initial));
    }
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return;
      setValue(readValue(key, initial));
    }
    window.addEventListener(EVENT, onSync as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onSync as EventListener);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        queueMicrotask(() => {
          try {
            window.localStorage.setItem(key, JSON.stringify(resolved));
            window.dispatchEvent(new CustomEvent(EVENT, { detail: { key } }));
          } catch {
            // ignore
          }
        });
        return resolved;
      });
    },
    [key],
  );

  return [value, set] as const;
}

export const STORAGE_KEYS = {
  sessions: "tennis.sessions.v1",
  trackers: "tennis.trackers.v1",
  opponents: "tennis.opponents.v1",
  players: "tennis.players.v1",
  customGames: "tennis.customGames.v1",
  locations: "tennis.locations.v1",
  theme: "tennis.theme.v1",
  myClassification: "tennis.myClassification.v1",
  surfaceVisibility: "tennis.surfaceVisibility.v1",
  defaultSurface: "tennis.defaultSurface.v1",
  locationVisibility: "tennis.locationVisibility.v1",
  maxSets: "tennis.maxSets.v1",
  cumulativeMaxSets: "tennis.cumulativeMaxSets.v1",
  userName: "tennis.userName.v1",
  userRating: "tennis.userRating.v1",
  defaultSessionsView: "tennis.defaultSessionsView.v1",
  forcedDoublesCtbLastSet: "tennis.forcedDoublesCtbLastSet.v1",
};
