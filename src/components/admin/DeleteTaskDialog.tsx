import type { Task } from "@/types";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";
import { AdminDialog } from "./AdminDialog";

export function DeleteTaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const store = useStore();
  const permissions = usePermissions();
  if (!permissions.canDeleteTask) return null;
  const kanban = store.kanbans.find((entry) => entry.id === task.kanbanId);
  return <AdminDialog title="Excluir tarefa?" description="A exclusão é permanente e não poderá ser desfeita." confirmLabel="Excluir permanentemente" onClose={onClose} onConfirm={async () => {
    if (!await store.deleteTask(task.id)) return "Não foi possível excluir a tarefa. Atualize a página e tente novamente.";
    store.addToast({ type: "success", title: "Tarefa excluída", message: `#${task.idTask} — ${task.title}` });
    return null;
  }}>
    <p className="text-sm break-words"><strong>#{task.idTask}{task.idRfc ? ` / RFC-${task.idRfc}` : ""}</strong> — {task.title}</p>
    <p className="text-sm">Kanban: {kanban?.name ?? "Indisponível"}</p>
    <p className="text-xs text-[var(--c-muted)]">Comentários e histórico serão excluídos. Os arquivos associados serão removidos pela fila de limpeza.</p>
  </AdminDialog>;
}
