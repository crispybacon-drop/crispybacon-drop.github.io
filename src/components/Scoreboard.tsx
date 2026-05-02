import { cn } from "@/lib/utils";

interface Props {
  leftLabel: string;
  rightLabel: string;
  leftScore: number;
  rightScore: number;
  /** Number of draws to show under the colon. Hidden if 0. */
  draws?: number;
  /** Optional caption (e.g. "12 sessions") shown under colon when draws not present. */
  caption?: string;
  size?: "sm" | "md";
}

/**
 * Sports-style head-to-head scoreboard:
 *   [ Left ]   15 : 5   [ Right ]
 * Highlights the winning side using --success.
 */
export function Scoreboard({
  leftLabel,
  rightLabel,
  leftScore,
  rightScore,
  draws = 0,
  caption,
  size = "md",
}: Props) {
  const leftWin = leftScore > rightScore;
  const rightWin = rightScore > leftScore;
  const numCls = size === "sm" ? "text-3xl" : "text-4xl";
  const labelCls = size === "sm" ? "text-[10px]" : "text-xs";
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 w-full items-center">
      {/* LEFT */}
      <div className="flex flex-col items-end gap-1 min-w-0 text-right">
        <div className={cn("truncate font-semibold max-w-full", labelCls, "uppercase tracking-wider text-muted-foreground")}>
          {leftLabel}
        </div>
        <div className={cn("font-display font-black tabular-nums leading-none", numCls, leftWin ? "text-success" : "text-foreground/70")}>
          {leftScore}
        </div>
      </div>
      {/* CENTER colon — perfectly centered on the score row via relative+absolute caption,
          so optional draw/caption text never shifts the colon's vertical position. */}
      <div className="relative flex items-center justify-center w-8 shrink-0 self-stretch">
        <div
          className={cn(
            "text-muted-foreground/60 font-display font-bold leading-none text-center",
            numCls,
          )}
          style={{ marginTop: size === "sm" ? "0.65rem" : "0.85rem" }}
        >
          :
        </div>
        {draws > 0 ? (
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-3 text-[10px] text-muted-foreground tabular-nums whitespace-nowrap text-center">{draws} {draws === 1 ? "draw" : "draws"}</div>
        ) : caption ? (
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-3 text-[10px] text-muted-foreground tabular-nums whitespace-nowrap text-center">{caption}</div>
        ) : null}
      </div>
      {/* RIGHT */}
      <div className="flex flex-col items-start gap-1 min-w-0 text-left">
        <div className={cn("truncate font-semibold max-w-full", labelCls, "uppercase tracking-wider text-muted-foreground")}>
          {rightLabel}
        </div>
        <div className={cn("font-display font-black tabular-nums leading-none", numCls, rightWin ? "text-success" : "text-foreground/70")}>
          {rightScore}
        </div>
      </div>
    </div>
  );
}
