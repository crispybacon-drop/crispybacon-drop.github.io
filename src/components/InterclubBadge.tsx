import { cn } from "@/lib/utils";

/** Small purple "IC" pill, matching the style of the red intensity "!" mark. */
export function InterclubDot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full text-white font-black leading-none",
        "bg-[var(--ic-purple)]",
        className,
      )}
      aria-label="Interclub"
      title="Interclub"
    >
      IC
    </span>
  );
}

/** Inline pill version (uppercase tag), used in card chip rows. */
export function InterclubPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest text-white bg-[var(--ic-purple)]",
        className,
      )}
    >
      IC
    </span>
  );
}
