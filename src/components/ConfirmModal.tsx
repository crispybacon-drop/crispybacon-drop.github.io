import { useEffect } from "react";
import { cn } from "@/lib/utils";

export type ConfirmTone = "destructive" | "default";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Lightweight in-app confirmation modal. Replaces window.confirm/alert across
 * the app to keep destructive actions on-brand and accessible.
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 flex flex-col gap-4"
      >
        <div>
          <div className="text-lg font-bold">{title}</div>
          {description && (
            <div className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
              {description}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "flex-1 py-3 rounded-2xl text-sm font-bold hover:brightness-110 transition",
              tone === "destructive"
                ? "bg-destructive text-destructive-foreground"
                : "bg-optic text-primary-foreground",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AlertProps {
  open: boolean;
  title: string;
  description?: string;
  okLabel?: string;
  onClose: () => void;
}

export function AlertModal({ open, title, description, okLabel = "OK", onClose }: AlertProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "Enter") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 flex flex-col gap-4"
      >
        <div>
          <div className="text-lg font-bold">{title}</div>
          {description && (
            <div className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
              {description}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-optic text-primary-foreground text-sm font-bold hover:brightness-110 transition"
        >
          {okLabel}
        </button>
      </div>
    </div>
  );
}
