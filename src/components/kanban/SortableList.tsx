import { useRef, useState, type ReactNode } from "react";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";

export function SortableList({ ids, onReorder, children, disabled = false, onBusyChange }: {
  ids: string[]; onReorder: (ids: string[]) => Promise<boolean>; children: ReactNode;
  disabled?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = async (event: DragEndEvent) => {
    if (disabled || pending.current || !event.over || event.active.id === event.over.id) return;
    const from = ids.indexOf(String(event.active.id)); const to = ids.indexOf(String(event.over.id));
    if (from < 0 || to < 0) return;
    pending.current = true; setSaving(true); onBusyChange?.(true);
    try { await onReorder(arrayMove(ids, from, to)); }
    finally { pending.current = false; setSaving(false); onBusyChange?.(false); }
  };
  return <div aria-busy={saving} className="space-y-2">
    <DndContext sensors={sensors} onDragEnd={(event) => void onDragEnd(event)}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext>
    </DndContext>
    {saving && <p role="status" className="text-xs text-[var(--c-muted)]">Salvando ordem…</p>}
  </div>;
}
