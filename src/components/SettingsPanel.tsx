import { useRef, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import { STORAGE_KEYS } from "@/lib/storage";
import { OPPONENT_RATINGS, SURFACES, type OpponentRating, type Surface } from "@/lib/types";
import { useSurfaceVisibility, type SurfaceVisibility } from "@/lib/visibleSurfaces";
import {
  useMaxSets,
  useCumulativeMaxSets,
  type MaxSets,
  type CumulativeMaxSets,
  useDefaultSessionsView,
  type DefaultSessionsView,
  useForcedDoublesCtbLastSet,
} from "@/lib/settings";
import { useUserName, useUserRating } from "@/lib/identity";
import { surfaceClasses } from "@/lib/surface";
import { Moon, Sun, Download, Upload, Check, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "./ConfirmModal";

const ALL_KEYS = Object.values(STORAGE_KEYS);
const EVENT = "lovable-storage-sync";

function todayStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function snapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ALL_KEYS) {
    const raw = window.localStorage.getItem(k);
    if (raw == null) continue;
    try {
      out[k] = JSON.parse(raw);
    } catch {
      out[k] = raw;
    }
  }
  return out;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { theme, toggle } = useTheme();
  const { visibility, setVisibility } = useSurfaceVisibility();
  
  const [maxSets, setMaxSets] = useMaxSets();
  const [cumulativeMaxSets, setCumulativeMaxSets] = useCumulativeMaxSets();
  const [defaultSessionsView, setDefaultSessionsView] = useDefaultSessionsView();
  const [forcedDoublesCtb, setForcedDoublesCtb] = useForcedDoublesCtbLastSet();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; msg?: string }>({ kind: "idle" });
  const [pendingImport, setPendingImport] = useState<{ incoming: Record<string, unknown>; knownKeys: string[] } | null>(
    null,
  );

  function exportData() {
    const data = {
      _meta: { app: "Baseline Tennis", exportedAt: new Date().toISOString(), version: 1 },
      data: snapshot(),
    };
    downloadJson(`tennis-backup-${todayStamp()}.json`, data);
    setStatus({ kind: "ok", msg: "Backup downloaded." });
  }

  function triggerImport() {
    fileRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incoming: Record<string, unknown> | undefined = parsed?.data ?? parsed;
      if (!incoming || typeof incoming !== "object") throw new Error("File doesn't look like a Baseline backup.");
      const knownKeys = ALL_KEYS.filter((k) => k in incoming);
      if (knownKeys.length === 0) throw new Error("No recognized data in this file.");
      setPendingImport({ incoming, knownKeys });
    } catch (err) {
      console.error("Import failed", err);
      setStatus({ kind: "err", msg: err instanceof Error ? err.message : "Import failed." });
    }
  }

  function applyImport() {
    if (!pendingImport) return;
    const { incoming, knownKeys } = pendingImport;
    downloadJson(`tennis-backup-auto-${todayStamp()}.json`, {
      _meta: { app: "Baseline Tennis", exportedAt: new Date().toISOString(), version: 1, auto: true },
      data: snapshot(),
    });
    for (const k of ALL_KEYS) window.localStorage.removeItem(k);
    for (const k of knownKeys) {
      try {
        window.localStorage.setItem(k, JSON.stringify(incoming[k]));
        window.dispatchEvent(new CustomEvent(EVENT, { detail: { key: k } }));
      } catch (writeErr) {
        console.error("Failed to write key", k, writeErr);
      }
    }
    setStatus({ kind: "ok", msg: `Imported ${knownKeys.length} dataset${knownKeys.length === 1 ? "" : "s"}.` });
    setPendingImport(null);
  }

  function toggleSurface(id: Surface) {
    const currentlyOn = visibility[id] !== false;
    if (currentlyOn) {
      // Block disabling the last enabled surface.
      const enabledCount = SURFACES.filter((s) => visibility[s.id] !== false).length;
      if (enabledCount <= 1) {
        setStatus({ kind: "err", msg: "At least one surface must remain enabled." });
        return;
      }
    }
    const next: SurfaceVisibility = { ...visibility, [id]: !currentlyOn };
    setVisibility(next);
  }

  return (
    <section className="flex flex-col gap-2 pb-4">
      <div className="flex items-center justify-between gap-3 h-10">
        <h2 className="text-2xl font-bold shrink-0 leading-none flex items-center h-full">Settings</h2>
        <button
          type="button"
          onClick={toggle}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          className="relative h-10 w-[72px] rounded-full bg-card border border-border shrink-0 hover:border-foreground/40 transition"
        >
          <span
            aria-hidden
            className={cn(
              "absolute top-1/2 left-1 -translate-y-1/2 size-8 rounded-full bg-optic transition-transform duration-200",
              theme === "dark" ? "translate-x-0" : "translate-x-[32px]",
            )}
          />
          <Moon
            aria-hidden
            className={cn(
              "absolute top-1/2 left-1 -translate-y-1/2 translate-x-[8px] size-4 z-10 transition-colors pointer-events-none",
              theme === "dark" ? "text-primary-foreground" : "text-muted-foreground",
            )}
          />
          <Sun
            aria-hidden
            className={cn(
              "absolute top-1/2 left-1 -translate-y-1/2 translate-x-[40px] size-4 z-10 transition-colors pointer-events-none",
              theme === "light" ? "text-primary-foreground" : "text-muted-foreground",
            )}
          />
        </button>
        <button
          onClick={onClose}
          className="h-10 px-4 rounded-full bg-success text-success-foreground font-bold text-xs uppercase tracking-widest hover:brightness-110 transition shrink-0 flex items-center"
        >
          Done
        </button>
      </div>

      {/* Identity (local-only) */}
      <IdentityCard />

      {/* Max Sets */}
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Max sets played</div>
          <div className="text-xs text-muted-foreground">
            Final set has CTB option (singles) or forced CTB (doubles).
          </div>
        </div>
        <div className="flex gap-1 p-1 bg-graphite/40 rounded-full">
          {([1, 3, 5] as MaxSets[]).map((n) => (
            <button
              key={n}
              onClick={() => setMaxSets(n)}
              className={cn(
                "size-9 rounded-full font-bold text-sm transition",
                maxSets === n ? "bg-optic text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Forced CTB in doubles last set */}
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Forced CTB in doubles in last set</div>
          <div className="text-xs text-muted-foreground">
            Replace the deciding doubles set with a champions tiebreak.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={forcedDoublesCtb}
          onClick={() => setForcedDoublesCtb(!forcedDoublesCtb)}
          className={cn(
            "relative w-12 h-7 rounded-full transition-colors shrink-0",
            forcedDoublesCtb ? "bg-optic" : "bg-graphite/60",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 size-6 rounded-full bg-background shadow transition-transform",
              forcedDoublesCtb && "translate-x-5",
            )}
          />
        </button>
      </div>

      {/* Cumulative Mini-game rounds */}
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Mini-game rounds (cumulative)</div>
          <div className="text-xs text-muted-foreground">Max rows for cumulative-style mini-games.</div>
        </div>
        <div className="flex gap-1 p-1 bg-graphite/40 rounded-full">
          {([1, 2, 3] as CumulativeMaxSets[]).map((n) => (
            <button
              key={n}
              onClick={() => setCumulativeMaxSets(n)}
              className={cn(
                "size-9 rounded-full font-bold text-sm transition",
                cumulativeMaxSets === n
                  ? "bg-optic text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Default Sessions View */}
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Default Sessions View</div>
          <div className="text-xs text-muted-foreground">Layout used when opening "All Sessions".</div>
        </div>
        <div className="flex gap-1 p-1 bg-graphite/40 rounded-full">
          {(["grid", "list"] as DefaultSessionsView[]).map((v) => (
            <button
              key={v}
              onClick={() => setDefaultSessionsView(v)}
              className={cn(
                "size-9 rounded-full flex items-center justify-center transition",
                defaultSessionsView === v
                  ? "bg-optic text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label={`Default to ${v} view`}
              aria-pressed={defaultSessionsView === v}
            >
              {v === "grid" ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
        <div>
          <div className="text-sm font-semibold">Surfaces</div>
          <div className="text-xs text-muted-foreground">Toggle visible across the app.</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SURFACES.map((s) => {
            const enabled = visibility[s.id] !== false;
            const ssc = surfaceClasses[s.id];
            return (
              <button
                key={s.id}
                onClick={() => toggleSurface(s.id)}
                className={cn(
                  "min-w-0 px-2 py-2 rounded-2xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                  enabled
                    ? `${ssc.border} ${ssc.bgSoft} text-foreground`
                    : "border-border text-muted-foreground/50 opacity-50",
                )}
              >
                <span className={cn("size-2.5 rounded-full shrink-0", enabled ? ssc.dot : "bg-muted-foreground/30")} />
                <span className="truncate">{s.label}</span>
                <span className="text-[9px] uppercase tracking-wider shrink-0">{enabled ? "On" : "Off"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Data export / import */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
        <div>
          <div className="text-sm font-semibold">Your Data</div>
          <div className="text-xs text-muted-foreground">
            Backups include sessions, players, mini-games, locations, classification, and theme.
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={exportData}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background font-bold text-sm hover:brightness-110 transition"
          >
            <Download className="size-4" /> Export
          </button>
          <button
            onClick={triggerImport}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-border text-foreground font-bold text-sm hover:border-foreground/40 transition"
          >
            <Upload className="size-4" /> Import
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />
        {status.kind !== "idle" && (
          <div
            className={cn(
              "text-xs rounded-lg px-3 py-2 flex items-center gap-2",
              status.kind === "ok" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
            )}
          >
            {status.kind === "ok" && <Check className="size-3.5" />}
            <span>{status.msg}</span>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Importing replaces all current data. We auto-download a backup first (named{" "}
          <span className="font-mono">tennis-backup-auto-{todayStamp()}.json</span>).
        </p>
      </div>

      <ConfirmModal
        open={!!pendingImport}
        title="Replace all data?"
        description={
          pendingImport
            ? `This will REPLACE all current data with the file you selected (${pendingImport.knownKeys.length} dataset${pendingImport.knownKeys.length === 1 ? "" : "s"}).\n\nA backup of your current data will be downloaded first.`
            : ""
        }
        confirmLabel="Replace data"
        tone="destructive"
        onConfirm={applyImport}
        onCancel={() => setPendingImport(null)}
      />
    </section>
  );
}

function IdentityCard() {
  const [name, setName] = useUserName();
  const [rating, setRating] = useUserRating();
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
      <div className="text-sm font-semibold">Your Identity</div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name"
          maxLength={24}
          className="flex-1 min-w-0 bg-background border-2 border-border rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-optic placeholder:text-muted-foreground"
        />
        <select
          value={rating}
          onChange={(e) => setRating(e.target.value as OpponentRating | "")}
          className="bg-background border-2 border-border rounded-xl px-3 py-2 text-sm font-bold tabular-nums focus:outline-none focus:border-optic shrink-0"
          aria-label="Your rating"
        >
          <option value="">R-</option>
          {OPPONENT_RATINGS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
