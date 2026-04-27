import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { KanbanCard } from "./KanbanCard";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";
import type { Task, TaskStatus } from "@/types";
import { statusColors, statusDisplayNames } from "@/types";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
}

export function KanbanColumn({ status, tasks }: KanbanColumnProps) {
  const openTaskModal = useStore((s) => s.openTaskModal);
  const perms = usePermissions();

  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { status },
  });

  const canCreate = perms.canCreateInColumn(status);
  const color = statusColors[status];
  const title = statusDisplayNames[status];

  return (
    <div className="flex flex-col min-w-[320px] max-w-[320px] shrink-0">
      {/* Column header */}
      <div
        className="flex items-center justify-between pb-3 mb-3 border-t-[3px] pt-3"
        style={{ borderTopColor: color }}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-[18px] font-semibold text-[#F0F0F0] tracking-[-0.5px] leading-6">
            {title}
          </h2>
          <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 bg-[#1E1E1E] rounded text-[11px] font-medium tracking-[0.5px] text-[#5A5A5A]">
            {tasks.length}
          </span>
        </div>
        {canCreate && (
          <button
            onClick={() => openTaskModal("create", null, status)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#5A5A5A] hover:text-[#F0F0F0] hover:bg-[#262626] transition-colors"
          >
            <Plus size={18} />
          </button>
        )}
      </div>

      {/* Column body */}
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-3 flex-1 min-h-[200px] rounded-lg p-2 transition-colors ${
          isOver ? "bg-[rgba(242,201,76,0.04)]" : ""
        }`}
        style={isOver ? { outline: `2px dashed ${color}`, outlineOffset: '-2px' } : {}}
      >
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-[#5A5A5A] text-[13px]">Nenhuma tarefa</div>
            <div className="text-[#5A5A5A] text-[11px] mt-1 opacity-70">
              Arraste tarefas para aqui
            </div>
            {canCreate && (
              <button
                onClick={() => openTaskModal("create", null, status)}
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
