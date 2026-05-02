import { useLocalStorage, STORAGE_KEYS } from "@/lib/storage";
import type { SavedLocation, Session, Surface } from "@/lib/types";
import { SURFACES } from "@/lib/types";
import { surfaceClasses } from "@/lib/surface";
import React, { useMemo, useState } from "react";
import { Plus, Trash2, MapPin, Star, GripVertical, Camera, Archive, RotateCcw, ChevronDown, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "./ConfirmModal";
import { compressImageFile } from "@/lib/imageCompress";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  /** When true, hide editing chrome (trash, drag, camera). Add bar stays. */
  readOnly?: boolean;
}

type MergedLocation = {
  id: string;
  name: string;
  createdAt: string;
  manual: boolean;
  uses: number;
  isFavorite: boolean;
  isHidden: boolean;
  order?: number;
  defaultSurface?: Surface;
  imageDataUrl?: string;
  imageOffsetX?: number;
  imageOffsetY?: number;
};

export function LocationsPanel({ readOnly = false }: Props) {
  const [locations, setLocations] = useLocalStorage<SavedLocation[]>(STORAGE_KEYS.locations, []);
  const [sessions, setSessions] = useLocalStorage<Session[]>(STORAGE_KEYS.sessions, []);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MergedLocation | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<MergedLocation | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  /** Location id whose cover image is currently in reposition mode. */
  const [repositioningId, setRepositioningId] = useState<string | null>(null);

  const auto = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      const n = s.location?.trim();
      if (n) set.add(n);
    }
    return set;
  }, [sessions]);

  const merged: MergedLocation[] = useMemo(() => {
    const known = new Map<string, MergedLocation>();
    for (const l of locations) {
      known.set(l.name.toLowerCase(), {
        id: l.id,
        name: l.name,
        createdAt: l.createdAt,
        manual: true,
        uses: 0,
        isFavorite: !!l.isFavorite,
        isHidden: !!l.isHidden,
        order: l.order,
        defaultSurface: l.defaultSurface,
        imageDataUrl: l.imageDataUrl,
        imageOffsetX: l.imageOffsetX,
        imageOffsetY: l.imageOffsetY,
      });
    }
    for (const n of auto) {
      const key = n.toLowerCase();
      if (!known.has(key)) {
        known.set(key, {
          id: `auto-${key}`,
          name: n,
          createdAt: "",
          manual: false,
          uses: 0,
          isFavorite: false,
          isHidden: false,
        });
      }
    }
    for (const s of sessions) {
      const n = s.location?.trim().toLowerCase();
      if (!n) continue;
      const v = known.get(n);
      if (v) v.uses += 1;
    }
    return Array.from(known.values()).sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return b.uses - a.uses || a.name.localeCompare(b.name);
    });
  }, [locations, auto, sessions]);

  const activeLocations = useMemo(() => merged.filter((l) => !l.isHidden), [merged]);
  const archivedLocations = useMemo(() => merged.filter((l) => l.isHidden), [merged]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function addLocation() {
    const n = name.trim();
    if (!n) return;
    if (locations.some((l) => l.name.toLowerCase() === n.toLowerCase())) {
      setName("");
      return;
    }
    const maxOrder = locations.reduce((m, l) => Math.max(m, l.order ?? 0), 0);
    const l: SavedLocation = {
      id: crypto.randomUUID(),
      name: n,
      createdAt: new Date().toISOString(),
      order: maxOrder + 1,
    };
    setLocations([l, ...locations]);
    setName("");
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.manual) {
      setLocations(locations.filter((l) => l.id !== deleteTarget.id));
    }
    // Auto-locations are derived; remove the link from past sessions instead.
    setSessions(
      sessions.map((s) =>
        s.location && s.location.toLowerCase() === deleteTarget.name.toLowerCase()
          ? { ...s, location: undefined }
          : s,
      ),
    );
    setDeleteTarget(null);
  }

  function confirmArchive() {
    if (!archiveTarget) return;
    if (archiveTarget.manual) {
      setLocations(locations.map((l) => (l.id === archiveTarget.id ? { ...l, isHidden: true } : l)));
    } else {
      const maxOrder = locations.reduce((m, l) => Math.max(m, l.order ?? 0), 0);
      setLocations([
        {
          id: crypto.randomUUID(),
          name: archiveTarget.name,
          createdAt: new Date().toISOString(),
          order: maxOrder + 1,
          isHidden: true,
        },
        ...locations,
      ]);
    }
    setArchiveTarget(null);
  }

  function unarchiveLocation(item: MergedLocation) {
    if (!item.manual) return;
    setLocations(locations.map((l) => (l.id === item.id ? { ...l, isHidden: false } : l)));
  }

  function startEdit(item: { id: string; name: string }) {
    setEditingId(item.id);
    setEditValue(item.name);
  }

  function saveEdit() {
    if (!editingId) return;
    const next = editValue.trim();
    if (!next) {
      setEditingId(null);
      return;
    }
    const original = merged.find((m) => m.id === editingId);
    if (!original) {
      setEditingId(null);
      return;
    }
    const oldName = original.name;
    if (oldName === next) {
      setEditingId(null);
      return;
    }
    if (original.manual) {
      setLocations(locations.map((l) => (l.id === editingId ? { ...l, name: next } : l)));
    } else {
      setLocations([
        { id: crypto.randomUUID(), name: next, createdAt: new Date().toISOString() },
        ...locations.filter((l) => l.name.toLowerCase() !== oldName.toLowerCase()),
      ]);
    }
    setSessions(
      sessions.map((s) =>
        s.location && s.location.toLowerCase() === oldName.toLowerCase()
          ? { ...s, location: next }
          : s,
      ),
    );
    setEditingId(null);
  }

  function ensureManual(item: MergedLocation): SavedLocation {
    if (item.manual) {
      return locations.find((l) => l.id === item.id)!;
    }
    const maxOrder = locations.reduce((m, l) => Math.max(m, l.order ?? 0), 0);
    const fresh: SavedLocation = {
      id: crypto.randomUUID(),
      name: item.name,
      createdAt: new Date().toISOString(),
      order: maxOrder + 1,
    };
    setLocations([fresh, ...locations]);
    return fresh;
  }

  function toggleFavorite(item: MergedLocation) {
    if (item.manual) {
      setLocations(
        locations.map((l) => (l.id === item.id ? { ...l, isFavorite: !l.isFavorite } : l)),
      );
    } else {
      const maxOrder = locations.reduce((m, l) => Math.max(m, l.order ?? 0), 0);
      setLocations([
        {
          id: crypto.randomUUID(),
          name: item.name,
          createdAt: new Date().toISOString(),
          isFavorite: true,
          order: maxOrder + 1,
        },
        ...locations,
      ]);
    }
  }

  function setDefaultSurface(item: MergedLocation, next: Surface | undefined) {
    if (readOnly) return;
    if (item.manual) {
      setLocations(
        locations.map((l) => (l.id === item.id ? { ...l, defaultSurface: next } : l)),
      );
    } else {
      const maxOrder = locations.reduce((m, l) => Math.max(m, l.order ?? 0), 0);
      setLocations([
        {
          id: crypto.randomUUID(),
          name: item.name,
          createdAt: new Date().toISOString(),
          defaultSurface: next,
          order: maxOrder + 1,
        },
        ...locations,
      ]);
    }
  }

  function setLocationImage(item: MergedLocation, dataUrl: string | undefined) {
    if (readOnly) return;
    const target = item.manual
      ? locations.find((l) => l.id === item.id)
      : null;
    if (target) {
      setLocations(locations.map((l) => (l.id === target.id ? { ...l, imageDataUrl: dataUrl, imageOffsetX: 50, imageOffsetY: 50 } : l)));
      setRepositioningId(dataUrl ? target.id : null);
      return;
    }
    // Promote auto to manual then attach image
    const maxOrder = locations.reduce((m, l) => Math.max(m, l.order ?? 0), 0);
    const newId = crypto.randomUUID();
    setLocations([
      {
        id: newId,
        name: item.name,
        createdAt: new Date().toISOString(),
        order: maxOrder + 1,
        imageDataUrl: dataUrl,
        imageOffsetX: 50,
        imageOffsetY: 50,
      },
      ...locations,
    ]);
    setRepositioningId(dataUrl ? newId : null);
  }

  function setLocationImageOffset(item: MergedLocation, x: number, y: number) {
    if (readOnly || !item.manual) return;
    setLocations(locations.map((l) => (l.id === item.id ? { ...l, imageOffsetX: x, imageOffsetY: y } : l)));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = activeLocations.map((l) => l.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(activeLocations, oldIndex, newIndex);
    const next = locations.map((l) => {
      const idx = reordered.findIndex((m) => m.id === l.id);
      return idx >= 0 ? { ...l, order: idx + 1 } : l;
    });
    setLocations(next);
  }

  // Suppress unused-warning until we wire ensureManual elsewhere
  void ensureManual;

  return (
    <section className="flex flex-col gap-4">
      {/* Permanent add bar */}
      <div className="bg-card border-2 border-border rounded-2xl p-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addLocation()}
          placeholder="+ Add a Location"
          className="flex-1 bg-transparent text-base focus:outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={addLocation}
          disabled={!name.trim()}
          className="size-9 rounded-full bg-optic text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:brightness-110 transition"
          aria-label="Add location"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {merged.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          No locations yet. Add a frequent court or club, or save it from a session.
        </div>
      ) : readOnly ? (
        <div className="flex flex-col gap-3">
          {activeLocations.map((l) => (
            <LocationCard
              key={l.id}
              loc={l}
              readOnly
              onToggleFavorite={() => toggleFavorite(l)}
            />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={activeLocations.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {activeLocations.map((l) => (
                <SortableLocationRow
                  key={l.id}
                  loc={l}
                  onDelete={() => setDeleteTarget(l)}
                  onArchive={() => setArchiveTarget(l)}
                  onUnarchive={() => unarchiveLocation(l)}
                  onToggleFavorite={() => toggleFavorite(l)}
                  onSetImage={(d) => setLocationImage(l, d)}
                  onSetImageOffset={(x, y) => setLocationImageOffset(l, x, y)}
                  onSetDefaultSurface={(s) => setDefaultSurface(l, s)}
                  repositioning={repositioningId === l.id}
                  onToggleReposition={() => setRepositioningId((cur) => (cur === l.id ? null : l.id))}
                />
              ))}
              {archivedLocations.length > 0 && (
                <div className="flex flex-col gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowArchived((v) => !v)}
                    className="self-start flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                    aria-expanded={showArchived}
                  >
                    <ChevronDown className={cn("size-3 transition-transform", !showArchived && "-rotate-90")} />
                    Archived ({archivedLocations.length})
                  </button>
                  {showArchived && archivedLocations.map((l) => (
                    <SortableLocationRow
                      key={l.id}
                      loc={l}
                      onDelete={() => setDeleteTarget(l)}
                      onArchive={() => setArchiveTarget(l)}
                      onUnarchive={() => unarchiveLocation(l)}
                      onToggleFavorite={() => toggleFavorite(l)}
                      onSetImage={(d) => setLocationImage(l, d)}
                      onSetImageOffset={(x, y) => setLocationImageOffset(l, x, y)}
                      onSetDefaultSurface={(s) => setDefaultSurface(l, s)}
                      repositioning={repositioningId === l.id}
                      onToggleReposition={() => setRepositioningId((cur) => (cur === l.id ? null : l.id))}
                    />
                  ))}
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : "Delete location?"}
        description="The location will be removed and unlinked from past sessions. Stats are kept."
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmModal
        open={!!archiveTarget}
        title={archiveTarget ? `Archive ${archiveTarget.name}?` : "Archive location?"}
        description="It will move to Archived and be hidden from location pickers. Past sessions keep their location history."
        confirmLabel="Archive"
        tone="destructive"
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </section>
  );
}

/** Read-only tall card variant (used outside edit mode). */
function LocationCard({
  loc: l,
  readOnly,
  onToggleFavorite,
}: {
  loc: MergedLocation;
  readOnly?: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <div
      className={cn(
        "bg-card border rounded-2xl overflow-hidden transition-all",
        l.isFavorite ? "border-2 border-[var(--star-yellow)]" : "border-border",
      )}
    >
      <CoverImage loc={l} />
      <div className="p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{l.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <span>{l.uses} {l.uses === 1 ? "session" : "sessions"}</span>
            {l.defaultSurface && (
              <span className={cn("flex items-center gap-1", surfaceClasses[l.defaultSurface].text)}>
                <span className={cn("size-1.5 rounded-full", surfaceClasses[l.defaultSurface].dot)} />
                {l.defaultSurface}
              </span>
            )}
          </div>
        </div>
        <FavStar isFavorite={l.isFavorite} onToggle={onToggleFavorite} readOnly={readOnly} />
      </div>
    </div>
  );
}

function CoverImage({
  loc,
  onUpload,
  reposition = false,
  onSetOffset,
  onDoneReposition,
}: {
  loc: MergedLocation;
  onUpload?: (dataUrl: string | undefined) => void;
  reposition?: boolean;
  onSetOffset?: (x: number, y: number) => void;
  onDoneReposition?: () => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef<{ startY: number; startX: number; ox: number; oy: number } | null>(null);

  function handleFile(file: File | undefined) {
    if (!file || !onUpload) return;
    if (!file.type.startsWith("image/")) return;
    // Allow large files — we'll downscale + JPEG-compress before storing.
    if (file.size > 1024 * 1024 * 12) return;
    compressImageFile(file)
      .then((dataUrl) => onUpload(dataUrl))
      .catch((err) => console.warn("Image compression failed", err));
  }

  const ox = loc.imageOffsetX ?? 50;
  const oy = loc.imageOffsetY ?? 50;
  const objectPosition = `${ox}% ${oy}%`;

  function onPointerDown(e: React.PointerEvent) {
    if (!reposition || !onSetOffset || !containerRef.current) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    draggingRef.current = { startX: e.clientX, startY: e.clientY, ox, oy };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current || !containerRef.current || !onSetOffset) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = e.clientX - draggingRef.current.startX;
    const dy = e.clientY - draggingRef.current.startY;
    // Inverted: dragging right reveals more of the LEFT side of the image (decrease X%).
    const nx = Math.min(100, Math.max(0, draggingRef.current.ox - (dx / rect.width) * 100));
    const ny = Math.min(100, Math.max(0, draggingRef.current.oy - (dy / rect.height) * 100));
    onSetOffset(nx, ny);
  }
  function onPointerUp() {
    draggingRef.current = null;
  }

  if (loc.imageDataUrl) {
    if (reposition && onSetOffset) {
      return (
        <div
          ref={containerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="block relative h-36 w-full bg-graphite cursor-grab active:cursor-grabbing select-none touch-none"
        >
          <img
            src={loc.imageDataUrl}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ objectPosition }}
          />
          <div className="absolute inset-0 ring-2 ring-optic ring-inset pointer-events-none" />
          <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/70 text-white text-[10px] font-bold uppercase tracking-widest pointer-events-none">
            Drag to reposition
          </div>
          {onDoneReposition && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDoneReposition(); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute top-2 right-2 px-3 py-1 rounded-full bg-optic text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:brightness-110"
            >
              Done
            </button>
          )}
        </div>
      );
    }
    if (onUpload) {
      return (
        <label className="block relative h-36 w-full bg-graphite cursor-pointer group">
          <img src={loc.imageDataUrl} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition }} />
          <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold uppercase tracking-widest transition">
            <Camera className="size-4 mr-1" /> Replace
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        </label>
      );
    }
    return (
      <div className="relative h-36 w-full bg-graphite">
        <img src={loc.imageDataUrl} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition }} />
      </div>
    );
  }
  // No image — show a compact placeholder strip only in edit mode (when onUpload provided).
  if (!onUpload) return null;
  return (
    <label className="flex items-center justify-center h-20 w-full bg-graphite/40 border-b border-border cursor-pointer hover:bg-graphite/60 transition gap-2 text-muted-foreground">
      <Camera className="size-4" />
      <span className="text-[11px] font-bold uppercase tracking-widest">Add cover photo</span>
      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
    </label>
  );
}

function SortableLocationRow({
  loc: l,
  onDelete,
  onArchive,
  onUnarchive,
  onToggleFavorite,
  onSetImage,
  onSetImageOffset,
  onSetDefaultSurface,
  repositioning,
  onToggleReposition,
}: {
  loc: MergedLocation;
  onDelete: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onToggleFavorite: () => void;
  onSetImage: (dataUrl: string | undefined) => void;
  onSetImageOffset: (x: number, y: number) => void;
  onSetDefaultSurface: (s: Surface | undefined) => void;
  repositioning: boolean;
  onToggleReposition: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: l.id,
  });
  void attributes; void listeners;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  function handleFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/") || file.size > 1024 * 1024 * 12) return;
    compressImageFile(file)
      .then((dataUrl) => onSetImage(dataUrl))
      .catch((err) => console.warn("Image compression failed", err));
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border rounded-2xl overflow-hidden transition-all",
        l.isFavorite
          ? "border-2 border-[var(--star-yellow)]"
          : "border-border",
      )}
    >
      <CoverImage
        loc={l}
        reposition={repositioning}
        onSetOffset={onSetImageOffset}
        onDoneReposition={onToggleReposition}
      />
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="size-10 rounded-full bg-graphite flex items-center justify-center shrink-0">
            <MapPin className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{l.name}</div>
          </div>
          <FavStar isFavorite={l.isFavorite} onToggle={onToggleFavorite} />
          <label className="size-8 rounded-full text-muted-foreground hover:text-optic flex items-center justify-center transition shrink-0 cursor-pointer" aria-label="Upload location image">
            <Camera className="size-4" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
          </label>
          {l.isHidden ? (
            <button
              type="button"
              onClick={onUnarchive}
              className="size-8 rounded-full text-muted-foreground hover:text-optic flex items-center justify-center transition shrink-0"
              aria-label="Restore location"
            >
              <RotateCcw className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onArchive}
              className="size-8 rounded-full text-muted-foreground/70 hover:text-destructive flex items-center justify-center transition shrink-0"
              aria-label="Archive location"
            >
              <Archive className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="size-8 rounded-full text-muted-foreground/60 hover:text-destructive flex items-center justify-center transition shrink-0"
            aria-label="Delete location"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        {l.imageDataUrl && (
          <div className="flex items-center gap-3 self-start pl-12">
            <button
              type="button"
              onClick={onToggleReposition}
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest transition",
                repositioning ? "text-optic" : "text-muted-foreground hover:text-optic",
              )}
            >
              {repositioning ? "Done repositioning" : "Reposition image"}
            </button>
            <button
              type="button"
              onClick={() => onSetImageOffset(50, 50)}
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-optic transition flex items-center gap-1"
              aria-label="Reset image position to center"
            >
              <Crosshair className="size-3" /> Center
            </button>
            <button
              type="button"
              onClick={() => onSetImage(undefined)}
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive transition"
            >
              Remove image
            </button>
          </div>
        )}
        <div className="flex flex-row items-center gap-2 pl-12 flex-nowrap overflow-x-auto">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
            Surface
          </span>
          {SURFACES.map((s) => {
            const active = l.defaultSurface === s.id;
            const ssc = surfaceClasses[s.id];
            return (
              <button
                type="button"
                key={s.id}
                onClick={() => onSetDefaultSurface(active ? undefined : s.id)}
                className={cn(
                  "px-2 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-all shrink-0 whitespace-nowrap",
                  active
                    ? `${ssc.border} ${ssc.bgSoft} ${ssc.text}`
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={active}
              >
                <span className={cn("size-1.5 rounded-full", ssc.dot)} />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FavStar({
  isFavorite,
  onToggle,
}: {
  isFavorite: boolean;
  onToggle?: () => void;
  readOnly?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle?.();
      }}
      className="size-9 rounded-full flex items-center justify-center transition-all shrink-0 hover:scale-110 hover:bg-[var(--star-yellow)]/10"
      aria-label={isFavorite ? "Unfavorite location" : "Favorite location"}
      aria-pressed={isFavorite}
    >
      <Star
        className={cn(
          "size-5 transition-colors",
          isFavorite
            ? "fill-[var(--star-yellow)] text-[var(--star-yellow)]"
            : "text-muted-foreground/50",
        )}
      />
    </button>
  );
}

