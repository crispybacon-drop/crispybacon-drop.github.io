/**
 * Color rule for W/L counters:
 *  - Green when wins > losses
 *  - Red when losses > wins
 *  - Neutral when equal (or both zero)
 */
export function wlClass(w: number, l: number): string {
  if (w === l) return "text-muted-foreground";
  return w > l ? "text-success" : "text-destructive";
}
