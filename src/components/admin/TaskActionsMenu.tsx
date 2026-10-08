import { MoreHorizontal, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { Task } from "@/types";

export function TaskActionsMenu({ task, onDelete }: { task: Task; onDelete: () => void }) {
  return <div onClick={(event) => event.stopPropagation()}>
    <DropdownMenu><DropdownMenuTrigger asChild><button aria-label={`Ações da tarefa #${task.idTask}`} className="p-2 rounded hover:bg-[var(--c-hover)]"><MoreHorizontal size={18} /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-[var(--c-surface)] text-[var(--c-text)] border-[var(--c-border)]"><DropdownMenuItem className="text-red-400" onSelect={onDelete}><Trash2 size={14} />Excluir tarefa</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
