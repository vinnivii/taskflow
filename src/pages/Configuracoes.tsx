import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Settings, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/store/useStore";
import { selectActiveKanban, slugify, uniqueKanbanSlug } from "@/lib/kanban";
import type { KanbanColumnKind } from "@/types";

const PRESET_COLORS = ["#A855F7", "#3B82F6", "#22C55E", "#EF4444", "#F97316", "#F2C94C", "#EC4899", "#14B8A6"];
const KIND_LABELS = { normal: "Normal", completed: "Concluída", blocked: "Bloqueada" };
const inputClass = "w-full h-9 px-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-md text-sm text-[var(--c-text)]";
const buttonClass = "h-8 px-3 rounded-md bg-[#F2C94C] text-[#0A0A0A] text-xs font-semibold disabled:opacity-40";
interface FormState { name: string; slug: string; color: string; kind: KanbanColumnKind }
const emptyForm: FormState = { name: "", slug: "", color: "#3B82F6", kind: "normal" };

function EntityForm({ initial, isKanban, unavailableKinds = [], suggestSlug, onSave, onCancel }: {
  initial: FormState; isKanban: boolean; unavailableKinds?: KanbanColumnKind[];
  suggestSlug?: (name: string) => string; onSave: (form: FormState) => Promise<boolean>; onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [manualSlug, setManualSlug] = useState(!!initial.slug);
  const [saving, setSaving] = useState(false);
  const valid = !!form.name.trim() && /^#[0-9a-f]{6}$/i.test(form.color) && (!isKanban || !!form.slug);
  return <form className="p-4 space-y-3 bg-[var(--c-surface-3)] rounded-lg border border-[var(--c-border-2)]" onSubmit={(event) => {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    void onSave({ ...form, name: form.name.trim() }).then((ok) => { setSaving(false); if (ok) onCancel(); });
  }}>
    <label className="block text-xs space-y-1">Nome
      <input autoFocus aria-label={isKanban ? "Nome do Kanban" : "Nome da coluna"} className={inputClass} value={form.name} onChange={(event) => {
        const name = event.target.value;
        setForm({ ...form, name, slug: isKanban && !manualSlug ? (suggestSlug?.(name) ?? slugify(name)) : form.slug });
      }} />
    </label>
    {isKanban && <label className="block text-xs space-y-1">Endereço do Kanban
      <input aria-label="Slug do Kanban" className={inputClass} value={form.slug} onChange={(event) => {
        setManualSlug(true); setForm({ ...form, slug: slugify(event.target.value) });
      }} />
    </label>}
    {!isKanban && <label className="block text-xs space-y-1">Função da coluna
      <select aria-label="Função da coluna" className={inputClass} value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as KanbanColumnKind })}>
        {Object.entries(KIND_LABELS).map(([kind, name]) => <option key={kind} value={kind} disabled={unavailableKinds.includes(kind as KanbanColumnKind)}>{name}</option>)}
      </select>
    </label>}
    <div className="flex flex-wrap items-center gap-2">
      {PRESET_COLORS.map((color) => <button type="button" aria-label={`Cor ${color}`} key={color} className="w-7 h-7 rounded-full border-2" style={{ background: color, borderColor: form.color === color ? "white" : "transparent" }} onClick={() => setForm({ ...form, color })} />)}
      <input aria-label="Cor personalizada" className="w-24 h-8 px-2 rounded bg-[var(--c-surface)] border border-[var(--c-border)] text-xs" value={form.color} maxLength={7} onChange={(event) => setForm({ ...form, color: event.target.value })} />
    </div>
    <div className="flex gap-3"><button className={buttonClass} disabled={!valid || saving}>{saving ? "Salvando…" : "Salvar"}</button><button type="button" disabled={saving} onClick={onCancel} className="text-xs">Cancelar</button></div>
  </form>;
}

function EntityRow({ id, form, count, isKanban, active, unavailableKinds, onSelect, onSave, onDelete }: {
  id: string; form: FormState; count: number; isKanban: boolean; active?: boolean;
  unavailableKinds?: KanbanColumnKind[]; onSelect?: () => void;
  onSave: (form: FormState) => Promise<boolean>; onDelete: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
    {editing ? <EntityForm initial={form} isKanban={isKanban} unavailableKinds={unavailableKinds} onSave={onSave} onCancel={() => setEditing(false)} /> :
      <div className={`flex flex-wrap items-center gap-2 px-3 py-3 rounded-lg border bg-[var(--c-surface-3)] ${active ? "border-[#F2C94C]/60" : "border-[var(--c-border)]"}`}>
        <button aria-label={`Reordenar ${form.name}`} className="touch-none cursor-grab text-[var(--c-muted)]" {...attributes} {...listeners}><GripVertical size={16} /></button>
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: form.color }} />
        <div className="flex-1 min-w-24">
          {onSelect ? <button className="text-sm font-medium text-left" onClick={onSelect}>{form.name}</button> : <span className="text-sm font-medium">{form.name}</span>}
          <p className="text-[11px] text-[var(--c-muted)] break-all">{isKanban ? `/${form.slug}` : KIND_LABELS[form.kind]}</p>
        </div>
        <span className="text-[11px] text-[var(--c-muted)]">{count} tarefa(s)</span>
        <button aria-label={`Editar ${form.name}`} className="p-1.5" onClick={() => setEditing(true)}><Pencil size={14} /></button>
        <button aria-label={`Excluir ${form.name}`} className="p-1.5 text-red-400 disabled:opacity-30" disabled={count > 0 || deleting} title={count ? `${count} tarefa(s), incluindo arquivadas. Exclusão bloqueada.` : "Excluir"} onClick={() => setConfirmDelete(true)}><Trash2 size={14} /></button>
        {confirmDelete && <div className="w-full flex flex-wrap items-center gap-3 text-xs" role="alert">
          <span>Excluir {form.name}?</span><button className={buttonClass} disabled={deleting} onClick={() => {
            setDeleting(true); void onDelete().then((ok) => { setDeleting(false); if (ok) setConfirmDelete(false); });
          }}>Confirmar exclusão</button><button onClick={() => setConfirmDelete(false)}>Cancelar</button>
        </div>}
      </div>}
  </div>;
}

function SortableList({ ids, onReorder, children }: { ids: string[]; onReorder: (ids: string[]) => Promise<boolean>; children: React.ReactNode }) {
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }));
  const onDragEnd = (event: DragEndEvent) => {
    if (saving || !event.over || event.active.id === event.over.id) return;
    const from = ids.indexOf(String(event.active.id)); const to = ids.indexOf(String(event.over.id));
    if (from < 0 || to < 0) return;
    setSaving(true); void onReorder(arrayMove(ids, from, to)).finally(() => setSaving(false));
  };
  return <div aria-busy={saving} className="space-y-2"><DndContext sensors={sensors} onDragEnd={onDragEnd}><SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext></DndContext></div>;
}

export function Configuracoes() {
  const store = useStore();
  const activeKanban = selectActiveKanban(store);
  const navigate = useNavigate();
  const [creating, setCreating] = useState<"kanban" | "column" | null>(null);
  const unavailableKinds = (exceptId?: string) => store.columns.filter((column) => column.id !== exceptId && column.kind !== "normal").map((column) => column.kind);
  const success = (title: string) => store.addToast({ type: "success", title, message: "Alterações salvas." });
  return <AppLayout title={`Configurações${activeKanban ? ` / ${activeKanban.name}` : ""}`}>
    <div className="max-w-3xl mx-auto space-y-6 py-2">
      <div className="flex items-center gap-3"><Settings size={24} /><div><h1 className="text-xl font-semibold">Configurações</h1><p className="text-sm text-[var(--c-muted)]">Gerencie Kanbans e suas colunas. As contagens incluem tarefas arquivadas.</p></div></div>
      <section className="p-4 rounded-xl bg-[var(--c-surface)] border border-[var(--c-border)] space-y-3">
        <div className="flex justify-between items-center"><h2 className="font-semibold">Kanbans</h2><button className={`${buttonClass} flex items-center gap-1`} onClick={() => setCreating("kanban")}><Plus size={14} />Novo Kanban</button></div>
        {creating === "kanban" && <EntityForm initial={emptyForm} isKanban suggestSlug={(name) => uniqueKanbanSlug(name, store.kanbans)} onCancel={() => setCreating(null)} onSave={async (form) => {
          const created = await store.createKanban({ name: form.name, slug: form.slug, color: form.color });
          if (!created) return false;
          navigate(`/configuracoes/${created.slug}`); success("Kanban criado"); return true;
        }} />}
        <SortableList ids={store.kanbans.map((kanban) => kanban.id)} onReorder={store.reorderKanbans}>
          {store.kanbans.map((kanban) => <EntityRow key={kanban.id} id={kanban.id} isKanban active={kanban.id === store.activeKanbanId} count={kanban.taskCount} form={{ ...kanban, kind: "normal" }} onSelect={() => navigate(`/configuracoes/${kanban.slug}`)} onDelete={() => store.deleteKanban(kanban.id)} onSave={async (form) => {
            const ok = await store.updateKanban(kanban.id, { name: form.name, slug: form.slug, color: form.color });
            if (ok) { if (kanban.id === store.activeKanbanId) navigate(`/configuracoes/${form.slug}`, { replace: true }); success("Kanban atualizado"); }
            return ok;
          }} />)}
        </SortableList>
      </section>
      {activeKanban && <section className="p-4 rounded-xl bg-[var(--c-surface)] border border-[var(--c-border)] space-y-3">
        <div className="flex flex-wrap gap-2 justify-between items-center"><h2 className="font-semibold">Colunas / {activeKanban.name}</h2><button className={`${buttonClass} flex items-center gap-1`} onClick={() => setCreating("column")}><Plus size={14} />Nova coluna</button></div>
        <p className="text-xs text-[var(--c-muted)]">Uma coluna concluída e uma bloqueada por Kanban. Arraste a alça para reorganizar.</p>
        {creating === "column" && <EntityForm initial={emptyForm} isKanban={false} unavailableKinds={unavailableKinds()} onCancel={() => setCreating(null)} onSave={async (form) => {
          const base = slugify(form.name) || "coluna";
          let key = base; let suffix = 2;
          while (store.columns.some((column) => column.key === key)) key = `${base}-${suffix++}`;
          const ok = await store.createColumn({ key, name: form.name, color: form.color, kind: form.kind });
          if (ok) success("Coluna criada"); return ok;
        }} />}
        <SortableList ids={store.columns.map((column) => column.id)} onReorder={store.reorderColumns}>
          {store.columns.map((column) => <EntityRow key={column.id} id={column.id} isKanban={false} count={store.tasks.filter((task) => task.columnId === column.id).length} form={{ ...column, slug: "" }} unavailableKinds={unavailableKinds(column.id)} onDelete={() => store.deleteColumn(column.id)} onSave={async (form) => {
            const ok = await store.updateColumn(column.id, { name: form.name, color: form.color, kind: form.kind });
            if (ok) success("Coluna atualizada"); return ok;
          }} />)}
        </SortableList>
        {!store.columns.length && <p className="text-sm text-[var(--c-muted)]">Adicione uma coluna para criar tarefas neste Kanban.</p>}
      </section>}
    </div>
  </AppLayout>;
}
