import { useRef, useState } from "react";
import type { KanbanColumn, KanbanColumnKind } from "@/types";
import { ColorPicker } from "./ColorPicker";
import { COLUMN_KIND_LABELS } from "@/lib/kanban";

export type ColumnFormValues = { name: string; color: string; kind: KanbanColumnKind; position: number };
const inputClass = "w-full h-9 px-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-md text-sm text-[var(--c-text)]";

export function ColumnForm({ column, columns, taskCount = 0, archivedCount = 0, terminology = "coluna", onSave, onCancel, onBusyChange }: {
  column?: KanbanColumn; columns: KanbanColumn[]; taskCount?: number; archivedCount?: number; terminology?: "coluna" | "status";
  onSave: (data: ColumnFormValues) => Promise<boolean>; onCancel: () => void; onBusyChange?: (busy: boolean) => void;
}) {
  const [form, setForm] = useState<ColumnFormValues>({ name: column?.name ?? "", color: column?.color ?? "#3B82F6", kind: column?.kind ?? "normal", position: columns.length });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const kindUnavailable = (kind: KanbanColumnKind) =>
    (kind !== "normal" && columns.some((entry) => entry.id !== column?.id && entry.kind === kind)) ||
    (archivedCount > 0 && column?.kind === "completed" && kind !== "completed");
  const valid = !!form.name.trim() && /^#[0-9a-f]{6}$/i.test(form.color) && !kindUnavailable(form.kind);
  const nameLabel = terminology === "status" ? "Nome do status" : "Nome da coluna";
  const kindLabel = terminology === "status" ? "Tipo funcional" : "Função da coluna";
  return <form className="p-4 space-y-3 bg-[var(--c-surface-3)] rounded-lg border border-[var(--c-border-2)]" onSubmit={async (event) => {
    event.preventDefault(); if (!valid || pending.current) return;
    pending.current = true; setSaving(true); setError(""); onBusyChange?.(true);
    try {
      const ok = await onSave({ ...form, name: form.name.trim(), position: Math.min(form.position, columns.length) });
      if (ok) onCancel(); else setError("Não foi possível salvar. Confira a mensagem de erro e tente novamente.");
    } catch { setError("Não foi possível salvar. Tente novamente."); }
    finally { pending.current = false; setSaving(false); onBusyChange?.(false); }
  }}>
    <fieldset disabled={saving} className="space-y-3">
      <label className="block text-xs space-y-1">Nome
        <input autoFocus aria-label={nameLabel} className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      </label>
      <label className="block text-xs space-y-1">{kindLabel}
        <select aria-label={kindLabel} className={inputClass} value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as KanbanColumnKind })}>
          {Object.entries(COLUMN_KIND_LABELS).map(([kind, label]) => <option key={kind} value={kind} disabled={kindUnavailable(kind as KanbanColumnKind)}>{label}</option>)}
        </select>
      </label>
      <p className="text-xs text-[var(--c-muted)]">Cada Kanban pode ter uma função de conclusão e uma de bloqueio.</p>
      {column && form.kind !== column.kind && taskCount > 0 && <p role="status" className="text-xs text-amber-400">Ao salvar, {taskCount} tarefa(s) deste status passarão a seguir as regras da função {COLUMN_KIND_LABELS[form.kind]}. Isso altera os indicadores de conclusão e as permissões de movimento.</p>}
      {archivedCount > 0 && <p className="text-xs text-amber-400">Há {archivedCount} tarefa(s) arquivada(s). A função de conclusão deve ser preservada.</p>}
      <ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} />
      {!column && <label className="block text-xs space-y-1">Posição na sequência
        <select aria-label="Posição na sequência" className={inputClass} value={Math.min(form.position, columns.length)} onChange={(event) => setForm({ ...form, position: Number(event.target.value) })}>
          {Array.from({ length: columns.length + 1 }, (_, index) => <option key={index} value={index}>{index + 1}{columns[index] ? ` · Antes de ${columns[index].name}` : " · No final"}</option>)}
        </select>
      </label>}
    </fieldset>
    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    <div className="flex gap-3">
      <button disabled={!valid || saving} className="h-8 px-3 rounded-md bg-[#F2C94C] text-[#0A0A0A] text-xs font-semibold disabled:opacity-40">{saving ? "Salvando…" : "Salvar"}</button>
      <button type="button" disabled={saving} onClick={onCancel} className="text-xs">Cancelar</button>
    </div>
  </form>;
}
