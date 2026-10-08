import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";
import { selectActiveKanban, uniqueColumnKey, COLUMN_KIND_LABELS } from "@/lib/kanban";
import type { KanbanColumn } from "@/types";
import { DeleteColumnDialog } from "@/components/admin/DeleteColumnDialog";
import { ColumnForm } from "./ColumnForm";
import { SortableList } from "./SortableList";

function ColumnRow({ column, count, archived, disabled, onEdit, onDelete }: {
  column: KanbanColumn; count: number; archived: number; disabled: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id, disabled });
  return <div ref={setNodeRef} data-column-id={column.id} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    className="flex flex-wrap items-center gap-2 px-3 py-3 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-3)]">
    <button type="button" aria-label={`Reordenar ${column.name}`} disabled={disabled} className="touch-none cursor-grab text-[var(--c-muted)] disabled:opacity-30" {...attributes} {...listeners}><GripVertical size={16} /></button>
    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: column.color }} />
    <div className="flex-1 min-w-24"><span className="text-sm font-medium break-words">{column.name}</span><p className="text-[11px] text-[var(--c-muted)]">{COLUMN_KIND_LABELS[column.kind]}</p></div>
    <span className="text-[11px] text-[var(--c-muted)]">{count} tarefa(s){archived ? ` · ${archived} arquivada(s)` : ""}</span>
    <button type="button" aria-label={`Editar ${column.name}`} disabled={disabled} className="p-1.5 disabled:opacity-30" onClick={onEdit}><Pencil size={14} /></button>
    <button type="button" aria-label={`Excluir ${column.name}`} disabled={disabled} className="p-1.5 text-red-400 disabled:opacity-30" onClick={onDelete}><Trash2 size={14} /></button>
  </div>;
}

export function ColumnsManager({ terminology = "coluna", initialCreating = false, onBusyChange }: {
  terminology?: "coluna" | "status"; initialCreating?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const store = useStore();
  const permissions = usePermissions();
  const [creating, setCreating] = useState(initialCreating);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<KanbanColumn | null>(null);
  const [busy, setBusy] = useState(false);
  const activeKanban = selectActiveKanban(store);
  const columns = store.columns.filter((column) => column.kanbanId === store.activeKanbanId);
  const editing = columns.find((column) => column.id === editingId);
  if (!permissions.canManageKanbans || !activeKanban) return null;
  const count = (columnId: string, archivedOnly = false) => store.tasks.filter((task) => task.kanbanId === activeKanban.id && task.columnId === columnId && (!archivedOnly || task.archived)).length;
  const changeBusy = (value: boolean) => { setBusy(value); onBusyChange?.(value); };
  const success = (title: string) => store.addToast({ type: "success", title, message: "Alterações salvas." });
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2 justify-between items-center">
      <h2 className="font-semibold">{terminology === "status" ? "Status" : "Colunas"} / {activeKanban.name}</h2>
      <button type="button" disabled={busy || creating || !!editing} className="h-8 px-3 rounded-md bg-[#F2C94C] text-black text-xs font-semibold flex items-center gap-1 disabled:opacity-40" onClick={() => setCreating(true)}><Plus size={14} />{terminology === "status" ? "Novo status" : "Nova coluna"}</button>
    </div>
    <p className="text-xs text-[var(--c-muted)]">As contagens incluem tarefas arquivadas. Arraste a alça para reorganizar ou use Espaço e as setas do teclado.</p>
    {creating && <ColumnForm columns={columns} terminology={terminology} onBusyChange={changeBusy} onCancel={() => setCreating(false)} onSave={async (form) => {
      const ok = await store.createColumn({ ...form, key: uniqueColumnKey(form.name, columns, activeKanban.id) });
      if (ok) success(terminology === "status" ? "Status criado" : "Coluna criada"); return ok;
    }} />}
    {editing && <ColumnForm key={editing.id} column={editing} columns={columns} taskCount={count(editing.id)} archivedCount={count(editing.id, true)} terminology={terminology} onBusyChange={changeBusy} onCancel={() => setEditingId(null)} onSave={async (form) => {
      const ok = await store.updateColumn(editing.id, { name: form.name, color: form.color, kind: form.kind });
      if (ok) success(terminology === "status" ? "Status atualizado" : "Coluna atualizada"); return ok;
    }} />}
    <SortableList ids={columns.map((column) => column.id)} onReorder={store.reorderColumns} disabled={busy || creating || !!editing} onBusyChange={changeBusy}>
      {columns.map((column) => <ColumnRow key={column.id} column={column} count={count(column.id)} archived={count(column.id, true)} disabled={busy || creating || !!editing}
        onEdit={() => setEditingId(column.id)} onDelete={() => setDeleting(column)} />)}
    </SortableList>
    {!columns.length && <p className="text-sm text-[var(--c-muted)]">Adicione um status para criar tarefas neste Kanban.</p>}
    {deleting && <DeleteColumnDialog column={deleting} onClose={() => setDeleting(null)} />}
  </div>;
}
