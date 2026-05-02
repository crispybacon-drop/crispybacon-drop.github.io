import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/storage";

export type ThemeMode = "dark" | "light";

function readTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const raw = window.localStorage.getItem(STORAGE_KEYS.theme);
  return raw === "light" ? "light" : "dark";
}

function applyTheme(t: ThemeMode) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.remove("light", "dark");
  html.classList.add(t);
  html.style.colorScheme = t;
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  // hydrate
  useEffect(() => {
    const t = readTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  function toggle() {
    setTheme((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEYS.theme, next);
      } catch {
        // ignore
      }
      applyTheme(next);
      return next;
    });
  }

  return { theme, toggle };
}
