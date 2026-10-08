import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Settings, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/store/useStore";
import { selectActiveKanban, slugify, uniqueKanbanSlug } from "@/lib/kanban";
import type { Kanban } from "@/types";
import { DeleteKanbanDialog } from "@/components/admin/DeleteKanbanDialog";
import { ColorPicker } from "@/components/kanban/ColorPicker";
import { ColumnsManager } from "@/components/kanban/ColumnsManager";
import { SortableList } from "@/components/kanban/SortableList";

const inputClass = "w-full h-9 px-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-md text-sm text-[var(--c-text)]";
const buttonClass = "h-8 px-3 rounded-md bg-[#F2C94C] text-[#0A0A0A] text-xs font-semibold disabled:opacity-40";
type FormState = Pick<Kanban, "name" | "slug" | "color">;
const emptyForm: FormState = { name: "", slug: "", color: "#3B82F6" };

function EntityForm({ initial, suggestSlug, onSave, onCancel }: {
  initial: FormState;
  suggestSlug?: (name: string) => string; onSave: (form: FormState) => Promise<boolean>; onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [manualSlug, setManualSlug] = useState(!!initial.slug);
  const [saving, setSaving] = useState(false);
  const valid = !!form.name.trim() && /^#[0-9a-f]{6}$/i.test(form.color) && !!form.slug;
  return <form className="p-4 space-y-3 bg-[var(--c-surface-3)] rounded-lg border border-[var(--c-border-2)]" onSubmit={(event) => {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    void onSave({ ...form, name: form.name.trim() }).then((ok) => { setSaving(false); if (ok) onCancel(); });
  }}>
    <label className="block text-xs space-y-1">Nome
      <input autoFocus aria-label="Nome do Kanban" className={inputClass} value={form.name} onChange={(event) => {
        const name = event.target.value;
        setForm({ ...form, name, slug: !manualSlug ? (suggestSlug?.(name) ?? slugify(name)) : form.slug });
      }} />
    </label>
    <label className="block text-xs space-y-1">Endereço do Kanban
      <input aria-label="Slug do Kanban" className={inputClass} value={form.slug} onChange={(event) => {
        setManualSlug(true); setForm({ ...form, slug: slugify(event.target.value) });
      }} />
    </label>
    <ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} disabled={saving} />
    <div className="flex gap-3"><button className={buttonClass} disabled={!valid || saving}>{saving ? "Salvando…" : "Salvar"}</button><button type="button" disabled={saving} onClick={onCancel} className="text-xs">Cancelar</button></div>
  </form>;
}

function EntityRow({ id, form, count, active, onSelect, onSave, onDelete }: {
  id: string; form: FormState; count: number; active?: boolean; onSelect?: () => void;
  onSave: (form: FormState) => Promise<boolean>; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
    {editing ? <EntityForm initial={form} onSave={onSave} onCancel={() => setEditing(false)} /> :
      <div className={`flex flex-wrap items-center gap-2 px-3 py-3 rounded-lg border bg-[var(--c-surface-3)] ${active ? "border-[#F2C94C]/60" : "border-[var(--c-border)]"}`}>
        <button aria-label={`Reordenar ${form.name}`} className="touch-none cursor-grab text-[var(--c-muted)]" {...attributes} {...listeners}><GripVertical size={16} /></button>
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: form.color }} />
        <div className="flex-1 min-w-24">
          {onSelect ? <button className="text-sm font-medium text-left" onClick={onSelect}>{form.name}</button> : <span className="text-sm font-medium">{form.name}</span>}
          <p className="text-[11px] text-[var(--c-muted)] break-all">/{form.slug}</p>
        </div>
        <span className="text-[11px] text-[var(--c-muted)]">{count} tarefa(s)</span>
        <button aria-label={`Editar ${form.name}`} className="p-1.5" onClick={() => setEditing(true)}><Pencil size={14} /></button>
        <button aria-label={`Excluir ${form.name}`} className="p-1.5 text-red-400" title="Excluir Kanban" onClick={onDelete}><Trash2 size={14} /></button>
      </div>}
  </div>;
}

export function Configuracoes() {
  const store = useStore();
  const activeKanban = selectActiveKanban(store);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [deletingKanban, setDeletingKanban] = useState<Kanban | null>(null);
  const success = (title: string) => store.addToast({ type: "success", title, message: "Alterações salvas." });
  return <AppLayout title={`Configurações${activeKanban ? ` / ${activeKanban.name}` : ""}`}>
    <div className="max-w-3xl mx-auto space-y-6 py-2">
      <div className="flex items-center gap-3"><Settings size={24} /><div><h1 className="text-xl font-semibold">Configurações</h1><p className="text-sm text-[var(--c-muted)]">Gerencie Kanbans e suas colunas. As contagens incluem tarefas arquivadas.</p></div></div>
      <section className="p-4 rounded-xl bg-[var(--c-surface)] border border-[var(--c-border)] space-y-3">
        <div className="flex justify-between items-center"><h2 className="font-semibold">Kanbans</h2><button className={`${buttonClass} flex items-center gap-1`} onClick={() => setCreating(true)}><Plus size={14} />Novo Kanban</button></div>
        {creating && <EntityForm initial={emptyForm} suggestSlug={(name) => uniqueKanbanSlug(name, store.kanbans)} onCancel={() => setCreating(false)} onSave={async (form) => {
          const created = await store.createKanban({ name: form.name, slug: form.slug, color: form.color });
          if (!created) return false;
          navigate(`/configuracoes/${created.slug}`); success("Kanban criado"); return true;
        }} />}
        <SortableList ids={store.kanbans.map((kanban) => kanban.id)} onReorder={store.reorderKanbans}>
          {store.kanbans.map((kanban) => <EntityRow key={kanban.id} id={kanban.id} active={kanban.id === store.activeKanbanId} count={kanban.taskCount} form={kanban} onSelect={() => navigate(`/configuracoes/${kanban.slug}`)} onDelete={() => setDeletingKanban(kanban)} onSave={async (form) => {
            const ok = await store.updateKanban(kanban.id, { name: form.name, slug: form.slug, color: form.color });
            if (ok) { if (kanban.id === store.activeKanbanId) navigate(`/configuracoes/${form.slug}`, { replace: true }); success("Kanban atualizado"); }
            return ok;
          }} />)}
        </SortableList>
      </section>
      {activeKanban && <section className="p-4 rounded-xl bg-[var(--c-surface)] border border-[var(--c-border)] space-y-3">
        <ColumnsManager key={activeKanban.id} />
      </section>}
      {deletingKanban && <DeleteKanbanDialog kanban={deletingKanban} onClose={() => setDeletingKanban(null)} />}
    </div>
  </AppLayout>;
}
