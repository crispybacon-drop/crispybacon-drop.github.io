import { useEffect, useMemo, useRef, useState } from "react";
import type { SetScore } from "@/lib/types";
import { Plus, X, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { isLegalSet, isLegalChampionsTiebreak, isTiebreakConsistent } from "@/lib/tennisRules";
import { isMatchDecided } from "@/lib/matchProgress";

interface Props {
  meName: string;
  oppName: string;
  sets: SetScore[];
  onChange: (sets: SetScore[]) => void;
  accentClass: string;
  accentText: string;
  maxSets?: number;
  /** When true, the LAST set in the array is forced to be a Champions Tiebreak. */
  forceFinalCtb?: boolean;
  /** When true, user can toggle the final set between normal/CTB. */
  allowFinalCtbToggle?: boolean;
  /** Color scheme: "match" (winner box accent) or "training" (neutral boxes, colored numbers). */
  colorScheme?: "match" | "training";
  /** Disable tennis score validation (used for "cumulative" mini-games). */
  disableValidation?: boolean;
  /** Strict Best-Of: when true, disable Add when match is mathematically decided. */
  strictBestOf?: boolean;
}

function needsTb(s: SetScore) {
  if (s.isCtb) return false;
  const a = s.me;
  const b = s.opp;
  if (a == null || b == null) return false;
  return (a === 7 && b === 6) || (a === 6 && b === 7);
}

export function ScoreGrid({
  meName,
  oppName,
  sets,
  onChange,
  accentClass,
  accentText,
  maxSets = 5,
  forceFinalCtb = false,
  allowFinalCtbToggle = false,
  colorScheme = "match",
  disableValidation = false,
  strictBestOf = false,
}: Props) {
  void colorScheme; void accentClass; void accentText;
  const cols = sets.length;

  function update(i: number, patch: Partial<SetScore>) {
    const next = sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange(next);
  }
  function addSet() {
    if (sets.length >= maxSets) return;
    const isLast = sets.length + 1 === maxSets;
    onChange([...sets, { me: null, opp: null, isCtb: isLast && forceFinalCtb }]);
  }
  function removeSet(i: number) {
    if (sets.length <= 1) return;
    onChange(sets.filter((_, idx) => idx !== i));
  }
  function toggleCtb(i: number) {
    update(i, { isCtb: !sets[i].isCtb, meTb: null, oppTb: null });
  }

  const headerCells = useMemo(() => Array.from({ length: cols }, (_, i) => i), [cols]);

  // Best-Of decision (strict mode only)
  const decided = strictBestOf && !disableValidation && isMatchDecided(sets, maxSets);
  const addDisabled = sets.length >= maxSets || decided;

  // Determine winner side for dynamic name color.
  // Use total sets won so far; "winning" side label turns green.
  const totals = useMemo(() => {
    let me = 0,
      opp = 0;
    for (const s of sets) {
      if (s.me == null || s.opp == null || s.me === s.opp) continue;
      if (s.me > s.opp) me++;
      else opp++;
    }
    return { me, opp };
  }, [sets]);
  const meIsWinner = totals.me > totals.opp && totals.me + totals.opp > 0;
  const oppIsWinner = totals.opp > totals.me && totals.me + totals.opp > 0;

  // Inline error messages
  const errors = useMemo(() => {
    if (disableValidation) return [];
    const errs: string[] = [];
    sets.forEach((s, i) => {
      if (!isTiebreakConsistent(s)) {
        errs.push(`Set ${i + 1}: TB winner must match set winner.`);
      }
      // NOTE: Don't warn while the user is mid-typing one side of a CTB.
      // Required-both-scores enforcement happens at save-time, not on input.
      if (
        !s.isCtb &&
        s.me != null &&
        s.opp != null &&
        !isLegalSet(s.me, s.opp)
      ) {
        errs.push(`Set ${i + 1}: invalid set score.`);
      }
      if (
        s.isCtb &&
        s.me != null &&
        s.opp != null &&
        !isLegalChampionsTiebreak(s.me, s.opp)
      ) {
        errs.push(`Set ${i + 1}: invalid Champions Tiebreak (first to 10, win by 2).`);
      }
    });
    return errs;
  }, [sets, disableValidation]);

  return (
    <div className="bg-graphite/30 rounded-2xl p-2.5 sm:p-3 flex flex-col gap-2">
      <div className="flex items-stretch gap-2.5">
        {/* Side labels — wider column so long names don't clip */}
        <div className="w-24 sm:w-28 flex flex-col justify-end gap-2 shrink-0 pb-[34px]">
          <div className="h-5" />
          <div className="h-16 flex items-center">
            <span
              className={cn(
                "text-xs sm:text-sm font-black uppercase tracking-wider truncate",
                meIsWinner ? "text-success" : "text-foreground/85",
              )}
              title={meName || "Me"}
            >
              {meName || "Me"}
            </span>
          </div>
          <div className="h-16 flex items-center">
            <span
              className={cn(
                "text-xs sm:text-sm font-black uppercase tracking-wider truncate",
                oppIsWinner ? "text-success" : "text-foreground/85",
              )}
              title={oppName || "Opp"}
            >
              {oppName || "Opp"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-2.5 items-start pt-2">
            {headerCells.map((i) => {
              const set = sets[i];
              const isFinal = i === cols - 1 && cols === maxSets;
              const ctb = !!set.isCtb;
              // Unified width — CTB and normal sets are exactly the same.
              const cellWidth = "w-[64px] sm:w-[72px]";
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "text-[10px] font-display tracking-[0.18em] uppercase relative text-center h-5 flex items-center justify-center gap-1",
                      cellWidth,
                      i === cols - 1 ? "text-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {ctb ? (
                      <span className="flex items-center gap-1">
                        <Trophy className="size-2.5" /> CTB
                      </span>
                    ) : (
                      <>Set {i + 1}</>
                    )}
                    {sets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSet(i)}
                        className="absolute -top-1 -right-1 size-4 rounded-full bg-graphite border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 flex items-center justify-center"
                        aria-label={`Remove set ${i + 1}`}
                      >
                        <X className="size-2.5" />
                      </button>
                    )}
                  </div>
                  {(() => {
                    const tbInconsistent = !disableValidation && !isTiebreakConsistent(set);
                    const ctbMissing = false; // suppressed during entry; validated at save-time
                    return (
                      <>
                        <ScoreCell
                          width={cellWidth}
                          side="me"
                          value={set.me}
                          tbValue={set.meTb}
                          showTb={!disableValidation && needsTb(set)}
                          onChange={(v) => update(i, { me: v })}
                          onTbChange={(v) => update(i, { meTb: v })}
                          isCtb={ctb}
                          counterpart={set.opp}
                          disableValidation={disableValidation}
                          tbInconsistent={tbInconsistent}
                          ctbMissing={!!ctbMissing}
                        />
                        <ScoreCell
                          width={cellWidth}
                          side="opp"
                          value={set.opp}
                          tbValue={set.oppTb}
                          showTb={!disableValidation && needsTb(set)}
                          onChange={(v) => update(i, { opp: v })}
                          onTbChange={(v) => update(i, { oppTb: v })}
                          isCtb={ctb}
                          counterpart={set.me}
                          disableValidation={disableValidation}
                          tbInconsistent={tbInconsistent}
                          ctbMissing={!!ctbMissing}
                        />
                      </>
                    );
                  })()}
                  {/* Reserved toggle row keeps every column's baseline aligned */}
                  <div className="h-7 flex items-center justify-center">
                    {isFinal && allowFinalCtbToggle && !forceFinalCtb && (
                      <button
                        type="button"
                        onClick={() => toggleCtb(i)}
                        className={cn(
                          "px-2 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wider transition",
                          ctb
                            ? "border-success bg-success/15 text-success"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {ctb ? "CTB" : "Normal"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addSet}
              disabled={addDisabled}
              className={cn(
                "w-[64px] sm:w-[72px] h-16 mt-7 border border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground hover:text-optic hover:border-optic transition-colors",
                addDisabled && "opacity-20 cursor-not-allowed hover:text-muted-foreground hover:border-border",
              )}
              aria-label={decided ? "Match decided" : "Add set"}
              title={decided ? "Match is mathematically decided" : "Add set"}
            >
              <Plus className="size-5" />
            </button>
          </div>
        </div>
      </div>
      {errors.length > 0 && (
        <div className="flex flex-col gap-0.5 px-1">
          {errors.slice(0, 3).map((e, i) => (
            <div key={i} className="text-[11px] font-semibold text-destructive">
              {e}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreCell({
  value,
  tbValue,
  showTb,
  onChange,
  onTbChange,
  isCtb,
  counterpart,
  width,
  side,
  disableValidation,
  tbInconsistent,
  ctbMissing,
}: {
  value: number | null | undefined;
  tbValue: number | null | undefined;
  showTb: boolean;
  onChange: (v: number | null) => void;
  onTbChange: (v: number | null) => void;
  isCtb: boolean;
  counterpart: number | null | undefined;
  width: string;
  side: "me" | "opp";
  disableValidation: boolean;
  tbInconsistent: boolean;
  ctbMissing: boolean;
}) {
  const filled = value != null;
  const winner = filled && counterpart != null && (value as number) > (counterpart as number);
  const loser = filled && counterpart != null && (value as number) < (counterpart as number);
  void loser;
  const bothFilled = value != null && counterpart != null;
  const setValid = disableValidation
    ? true
    : !bothFilled
      ? true
      : isCtb
        ? isLegalChampionsTiebreak(value, counterpart)
        : isLegalSet(value, counterpart);
  const valid = setValid && !tbInconsistent && !ctbMissing;

  // Trigger shake when invalid combo appears
  const [shake, setShake] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!valid) {
      setShake(false);
      requestAnimationFrame(() => setShake(true));
      const t = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(t);
    }
  }, [valid]);

  // UNIFIED MATCH STYLING for ALL contexts:
  //  - Winner: green border, solid white text
  //  - Inactive (loser/empty/equal): muted border, dimmed white text
  //  - Invalid: red border + red text
  let boxClass: string;
  let textClass: string;
  if (!valid) {
    boxClass = "border-destructive bg-destructive/5";
    textClass = "text-destructive";
  } else if (winner) {
    boxClass = "border-success bg-background";
    textClass = "text-foreground";
  } else if (filled) {
    // loser or draw
    boxClass = "border-border bg-muted/30";
    textClass = "text-foreground/40";
  } else {
    boxClass = "border-border bg-muted/20";
    textClass = "text-foreground/30";
  }

  const tbRef = useRef<HTMLInputElement>(null);
  const prevShowTb = useRef(false);
  useEffect(() => {
    if (showTb && !prevShowTb.current && side === "me" && tbValue == null) {
      requestAnimationFrame(() => tbRef.current?.focus());
    }
    prevShowTb.current = showTb;
  }, [showTb, side, tbValue]);

  const tbMissing = showTb && tbValue == null;

  return (
    // pr/pb reserve room for the TB chip so it never clips into siblings.
    <div className={cn("relative", showTb && "pr-3 pb-2.5")}>
      <input
        ref={ref}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value ?? ""}
        onChange={(e) => {
          const maxLen = disableValidation ? 3 : 2;
          const raw = e.target.value.replace(/\D/g, "").slice(0, maxLen);
          const num = raw === "" ? null : parseInt(raw, 10);
          if (!disableValidation && num != null && !isCtb && num > 7) return;
          onChange(num);
        }}
        placeholder="–"
        className={cn(
          "h-16 border-2 rounded-lg text-center font-display font-black tabular-nums focus:outline-none transition-colors",
          width,
          // Slightly reduced size to prevent clipping. CTB uses smaller still.
          isCtb ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl",
          boxClass,
          textClass,
          shake && "animate-shake",
        )}
      />
      {showTb && (
        <input
          ref={tbRef}
          inputMode="numeric"
          pattern="[0-9]*"
          value={tbValue ?? ""}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            const num = raw === "" ? null : parseInt(raw, 10);
            onTbChange(num);
          }}
          placeholder="tb"
          aria-invalid={tbMissing || tbInconsistent}
          className={cn(
            "absolute -bottom-1 -right-1 w-9 h-6 bg-card border-2 rounded-md text-center font-display text-[11px] font-bold focus:outline-none transition-colors leading-none shadow-sm z-10",
            tbMissing || tbInconsistent
              ? "border-destructive text-destructive animate-pulse"
              : "border-border text-optic focus:border-optic",
          )}
        />
      )}
    </div>
  );
}
