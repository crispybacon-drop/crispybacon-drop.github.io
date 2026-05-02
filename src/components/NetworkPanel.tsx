import { useEffect, useRef, useState } from "react";
import { PlayersPanel } from "./PlayersPanel";
import { LocationsPanel } from "./LocationsPanel";
import { ConfirmModal } from "./ConfirmModal";
import { cn } from "@/lib/utils";
import { Pencil, Check } from "lucide-react";

type Sub = "players" | "locations";

interface Props {
  onOpenGamesForPlayer?: (playerId: string) => void;
  /** Notifies parent when user attempts to leave this tab (used for unsaved-edit guard). */
  registerLeaveGuard?: (guard: (() => boolean) | null) => void;
}

export function NetworkPanel({ onOpenGamesForPlayer, registerLeaveGuard }: Props) {
  const [sub, setSub] = useState<Sub>("players");
  const [editMode, setEditMode] = useState(false);
  const [pendingSub, setPendingSub] = useState<Sub | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const editRef = useRef(editMode);
  editRef.current = editMode;

  // Register a leave-guard with parent so switching main tabs while editing prompts.
  useEffect(() => {
    if (!registerLeaveGuard) return;
    registerLeaveGuard(() => {
      if (editRef.current) {
        setConfirmDiscard(true);
        return true; // block
      }
      return false;
    });
    return () => registerLeaveGuard(null);
  }, [registerLeaveGuard]);

  function attemptSubChange(next: Sub) {
    if (next === sub) return;
    if (editMode) {
      setPendingSub(next);
      return;
    }
    setSub(next);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Network</h2>
          <p className="text-sm text-muted-foreground mt-1">
            People you play with and places you play at.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          aria-pressed={editMode}
          aria-label={editMode ? "Done editing" : "Edit network"}
          className={cn(
            "size-10 rounded-full border-2 flex items-center justify-center transition shrink-0",
            editMode
              ? "border-optic bg-optic text-primary-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {editMode ? <Check className="size-4" strokeWidth={3} /> : <Pencil className="size-4" />}
        </button>
      </div>

      <div className="flex gap-2 p-1 bg-card border border-border rounded-full">
        {(["players", "locations"] as Sub[]).map((s) => (
          <button
            key={s}
            onClick={() => attemptSubChange(s)}
            className={cn(
              "flex-1 px-4 py-2 rounded-full text-sm font-semibold transition-all capitalize",
              sub === s
                ? "bg-optic text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {sub === "players" ? (
        <PlayersPanel embedded onOpenGamesForPlayer={onOpenGamesForPlayer} editMode={editMode} />
      ) : (
        <LocationsPanel readOnly={!editMode} />
      )}

      <ConfirmModal
        open={!!pendingSub}
        title="You have unsaved changes"
        description="Save or discard your edits before switching."
        confirmLabel="Save"
        cancelLabel="Discard"
        onConfirm={() => {
          // Saving simply leaves the data as-is (every edit auto-persists).
          setEditMode(false);
          if (pendingSub) setSub(pendingSub);
          setPendingSub(null);
        }}
        onCancel={() => {
          setEditMode(false);
          if (pendingSub) setSub(pendingSub);
          setPendingSub(null);
        }}
      />

      <ConfirmModal
        open={confirmDiscard}
        title="You have unsaved changes"
        description="Save or discard your edits before leaving?"
        confirmLabel="Save"
        cancelLabel="Discard"
        onConfirm={() => {
          setEditMode(false);
          setConfirmDiscard(false);
        }}
        onCancel={() => {
          setEditMode(false);
          setConfirmDiscard(false);
        }}
      />
    </section>
  );
}
