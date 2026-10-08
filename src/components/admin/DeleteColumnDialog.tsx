import { useState } from "react";
import type { KanbanColumn } from "@/types";
import { useStore } from "@/store/useStore";
import { selectActiveKanban } from "@/lib/kanban";
import { usePermissions } from "@/hooks/usePermissions";
import { AdminDialog } from "./AdminDialog";

export function DeleteColumnDialog({ column, onClose }: { column: KanbanColumn; onClose: () => void }) {
  const store = useStore();
  const permissions = usePermissions();
  const tasks = store.tasks.filter((task) => task.columnId === column.id);
  const archived = tasks.some((task) => task.archived);
  const destinations = store.columns.filter((entry) => entry.id !== column.id && entry.kanbanId === column.kanbanId
    && (!archived || entry.kind === "completed") && (store.currentUser?.role === "supervisor_geral" || entry.kind !== "blocked"));
  const [mode, setMode] = useState<"transfer" | "delete">(tasks.length && destinations.length ? "transfer" : "delete");
  const [destination, setDestination] = useState(destinations[0]?.id ?? "");
  if (!permissions.canManageKanbans || store.activeKanbanId !== column.kanbanId) return null;
  const count = tasks.length;
  return <AdminDialog title="Excluir coluna" description={`Coluna: ${column.name} · Kanban: ${selectActiveKanban(store)?.name}`} confirmLabel={mode === "transfer" ? "Transferir e excluir coluna" : "Excluir coluna e tarefas"} disabled={mode === "transfer" && !destinations.some((entry) => entry.id === destination)} onClose={onClose} onConfirm={async () => {
    if (!await store.deleteColumnWithTasks(column.id, mode, mode === "transfer" ? destination : undefined)) return "Operação não concluída. Confira as colunas e atualize a página.";
    store.addToast({ type: "success", title: "Coluna excluída", message: mode === "transfer" ? "Todas as tarefas foram transferidas." : "Coluna e tarefas excluídas permanentemente." });
    return null;
  }}>
    <p className="text-sm">Tarefas existentes: <strong>{count}</strong>, incluindo arquivadas.</p>
    <label className="flex gap-2 text-sm"><input type="radio" name="column-mode" checked={mode === "transfer"} disabled={!destinations.length} onChange={() => setMode("transfer")} />Transferir todas para outra coluna</label>
    {mode === "transfer" && <label className="block text-sm">Coluna de destino<select className="block w-full p-2 mt-1 rounded bg-[var(--c-surface-3)] border border-[var(--c-border)]" value={destination} onChange={(event) => setDestination(event.target.value)}>{destinations.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label>}
    {!destinations.length && <p className="text-xs text-amber-400">Não há outra coluna compatível. Tarefas arquivadas exigem uma coluna de conclusão; as permissões de movimento também se aplicam.</p>}
    <label className="flex gap-2 text-sm"><input type="radio" name="column-mode" checked={mode === "delete"} onChange={() => setMode("delete")} />Excluir permanentemente as {count} tarefas e a coluna</label>
    {mode === "delete" && <p className="text-sm text-red-400">Esta ação não poderá ser desfeita. Comentários, histórico e arquivos das tarefas também serão removidos.</p>}
  </AdminDialog>;
}
