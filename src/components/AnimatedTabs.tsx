import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Tab<T extends string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  tabs: Tab<T>[];
  /** Pill background class (defaults to neon optic). */
  pillClass?: string;
  /** Active text color class. */
  activeTextClass?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Segmented control with a smoothly-sliding background pill.
 * Pure CSS transform animation — works on every browser, respects prefers-reduced-motion.
 */
export function AnimatedTabs<T extends string>({
  value,
  onChange,
  tabs,
  pillClass = "bg-optic",
  activeTextClass = "text-primary-foreground",
  size = "md",
  className,
}: Props<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = btnRefs.current[value];
    const container = containerRef.current;
    if (!el || !container) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    setPill({ left: eRect.left - cRect.left, width: eRect.width });
  }, [value, tabs.length]);

  // Recompute on resize for responsiveness
  useEffect(() => {
    function onResize() {
      const el = btnRefs.current[value];
      const container = containerRef.current;
      if (!el || !container) return;
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      setPill({ left: eRect.left - cRect.left, width: eRect.width });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [value]);

  const padY = size === "sm" ? "py-1.5" : "py-2.5";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div
      ref={containerRef}
      className={cn("relative flex gap-1 p-1 bg-card border border-border rounded-full", className)}
    >
      {pill && (
        <div
          aria-hidden
          className={cn("absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-out", pillClass)}
          style={{ left: pill.left, width: pill.width }}
        />
      )}
      {tabs.map((t) => (
        <button
          key={t.id}
          ref={(el) => { btnRefs.current[t.id] = el; }}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "relative z-10 flex-1 px-3 rounded-full font-bold uppercase tracking-wider transition-colors",
            padY,
            textSize,
            value === t.id ? activeTextClass : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
