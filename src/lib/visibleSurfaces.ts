import { useLocalStorage, STORAGE_KEYS } from "@/lib/storage";
import type { Surface } from "@/lib/types";
import { SURFACES } from "@/lib/types";

export type SurfaceVisibility = Record<Surface, boolean>;

const DEFAULT_VISIBILITY: SurfaceVisibility = { carpet: true, clay: true, hard: true };

export function useSurfaceVisibility() {
  const [v, setV] = useLocalStorage<SurfaceVisibility>(
    STORAGE_KEYS.surfaceVisibility,
    DEFAULT_VISIBILITY,
  );
  // Defensive merge in case stored shape is incomplete
  const merged: SurfaceVisibility = { ...DEFAULT_VISIBILITY, ...(v ?? {}) };
  const visibleSurfaces = SURFACES.filter((s) => merged[s.id] !== false);
  return { visibility: merged, setVisibility: setV, visibleSurfaces };
}
