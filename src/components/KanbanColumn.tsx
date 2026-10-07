import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { KanbanCard } from "./KanbanCard";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";
import type { Task, KanbanColumn as Column } from "@/types";

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
}

export function KanbanColumn({ column, tasks }: KanbanColumnProps) {
  const openTaskModal = useStore((s) => s.openTaskModal);
  const perms = usePermissions();

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { columnId: column.id, kanbanId: column.kanbanId },
  });

  const canCreate = perms.canCreateInColumn(column.id);
  const color = column.color;
  const title = column.name;

  return (
    <div className="flex flex-col min-w-[320px] max-w-[320px] shrink-0">
      {/* Column header */}
      <div
        className="flex items-center justify-between pb-3 mb-3 border-t-[3px] pt-3"
        style={{ borderTopColor: color }}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-[18px] font-semibold text-[var(--c-text)] tracking-[-0.5px] leading-6">
            {title}
          </h2>
          <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 bg-[var(--c-surface-3)] rounded text-[11px] font-medium tracking-[0.5px] text-[var(--c-muted-2)]">
            {tasks.length}
          </span>
        </div>
        {canCreate && (
          <button
            aria-label={`Nova tarefa em ${column.name}`}
            onClick={() => openTaskModal("create", null, column.id)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--c-muted-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] transition-colors"
          >
            <Plus size={18} />
          </button>
        )}
      </div>

      {/* Column body */}
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-3 flex-1 min-h-[200px] rounded-lg p-2 transition-all duration-200`}
        style={isOver ? {
          backgroundColor: `${color}08`,
          outline: `2px dashed ${color}55`,
          outlineOffset: '-2px',
          boxShadow: `inset 0 0 24px ${color}0a`,
        } : {}}
      >
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-[var(--c-muted-2)] text-[13px]">Nenhuma tarefa</div>
            <div className="text-[var(--c-muted-2)] text-[11px] mt-1 opacity-70">
              Arraste tarefas para aqui
            </div>
            {canCreate && (
              <button
                onClick={() => openTaskModal("create", null, column.id)}
                className="mt-3 text-[#F2C94C] text-[11px] font-medium hover:underline"
              >
                Criar tarefa
              </button>
            )}
          </div>
        ) : (
          tasks.map((task) => <KanbanCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}
