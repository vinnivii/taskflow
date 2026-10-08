import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Kanban, KanbanColumnKind } from "@/types";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/utils/supabase";
import { AdminDialog } from "./AdminDialog";

interface Summary { id: string; name: string; kind: KanbanColumnKind; task_count: number; archived_count: number }
export function DeleteKanbanDialog({ kanban, onClose }: { kanban: Kanban; onClose: () => void }) {
  const store = useStore();
  const permissions = usePermissions();
  const navigate = useNavigate();
  const [destinationId, setDestinationId] = useState("");
  const [source, setSource] = useState<Summary[]>([]);
  const [destination, setDestination] = useState<Summary[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      supabase.rpc("kanban_deletion_summary", { p_kanban_id: kanban.id }),
      destinationId ? supabase.rpc("kanban_deletion_summary", { p_kanban_id: destinationId }) : Promise.resolve({ data: [], error: null }),
    ]).then(([a, b]) => {
      if (cancelled) return;
      if (a.error || b.error || !a.data || !b.data) { setLoadError("Não foi possível carregar as colunas. Tente novamente."); setLoading(false); return; }
      const sources = a.data as Summary[]; const targets = b.data as Summary[];
      setSource(sources); setDestination(targets);
      setMapping(Object.fromEntries(sources.map((column) => {
        const eligible = targets.filter((target) => !column.archived_count || target.kind === "completed");
        const suggestion = eligible.find((target) => target.name.toLocaleLowerCase() === column.name.toLocaleLowerCase() && target.kind === column.kind)
          ?? eligible.find((target) => target.kind === column.kind);
        return [column.id, suggestion?.id ?? ""];
      })));
      setLoadError(""); setLoading(false);
    }).catch(() => { if (!cancelled) { setLoadError("Não foi possível carregar as colunas."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [kanban.id, destinationId, revision]);
  if (!permissions.canManageKanbans) return null;
  const count = source.reduce((total, column) => total + Number(column.task_count), 0);
  const others = store.kanbans.filter((entry) => entry.id !== kanban.id);
  const valid = !loading && !loadError && !!password && password.length <= 1024 && (!count || (others.some((entry) => entry.id === destinationId)
    && source.every((column) => destination.some((target) => target.id === mapping[column.id] && (!column.archived_count || target.kind === "completed")))));
  return <AdminDialog title="Excluir Kanban" description={`Kanban de origem: ${kanban.name}. A exclusão é permanente.`} confirmLabel={count ? "Transferir tarefas e excluir Kanban" : "Confirmar exclusão"} disabled={!valid} onClose={onClose} onConfirm={async () => {
    const target = others.find((entry) => entry.id === destinationId);
    const result = await store.transferAndDeleteKanban(kanban.id, count ? destinationId : null, count ? mapping : {}, password);
    if (!result.success) return result.error ?? "Não foi possível excluir o Kanban.";
    setPassword("");
    store.addToast({ type: "success", title: "Kanban excluído", message: `Kanban ${kanban.name} excluído.${result.transferred ? ` ${result.transferred} tarefas foram transferidas para ${target?.name}.` : ""}` });
    const next = count ? target : useStore.getState().kanbans[0];
    navigate(next ? `/configuracoes/${next.slug}` : "/configuracoes", { replace: true });
    return null;
  }}>
    {loading ? <p role="status">Carregando colunas e contagens…</p> : <p className="text-sm">{source.length} coluna(s) · {count} tarefa(s), incluindo arquivadas.</p>}
    {loadError && <p role="alert" className="text-sm text-red-400">{loadError} <button type="button" onClick={() => { setLoading(true); setRevision(revision + 1); }}>Atualizar</button></p>}
    {!loading && count > 0 && <>
      {!others.length && <p role="alert" className="text-sm text-amber-400">Crie outro Kanban antes de excluir este. Todas as tarefas precisam de um destino.</p>}
      <label className="block text-sm">Kanban de destino<select value={destinationId} className="block w-full p-2 mt-1 rounded bg-[var(--c-surface-3)] border border-[var(--c-border)]" onChange={(event) => { setLoading(true); setDestinationId(event.target.value); }}><option value="">Selecione um Kanban</option>{others.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
    </>}
    {count > 0 && destinationId && source.map((column) => {
      const targets = destination.filter((target) => !column.archived_count || target.kind === "completed");
      return <label key={column.id} className="block text-sm">{column.name} ({column.task_count} tarefas, {column.archived_count} arquivadas)<select aria-label={`Destino de ${column.name}`} className="block w-full p-2 mt-1 rounded bg-[var(--c-surface-3)] border border-[var(--c-border)]" value={mapping[column.id] ?? ""} onChange={(event) => setMapping({ ...mapping, [column.id]: event.target.value })}><option value="">Selecione uma coluna</option>{targets.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>{!targets.length && <span className="text-xs text-amber-400">Configure uma coluna compatível no destino antes de continuar.</span>}</label>;
    })}
    <label className="block text-sm">Senha administrativa<input type="password" autoComplete="off" maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} className="block w-full p-2 mt-1 rounded bg-[var(--c-surface-3)] border border-[var(--c-border)]" /></label>
  </AdminDialog>;
}
