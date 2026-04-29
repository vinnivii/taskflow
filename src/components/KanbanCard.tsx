import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Clock, MessageSquare, Paperclip } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useStore } from "@/store/useStore";
import { getUserById } from "@/data/mockData";
import { priorityColors, statusColors, departmentColors } from "@/types";
import type { Task, TaskPriority } from "@/types";

interface KanbanCardProps {
  task: Task;
}

export function KanbanCard({ task }: KanbanCardProps) {
  const openTaskModal = useStore((s) => s.openTaskModal);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const assignee = getUserById(task.assigneeId);
  const isOverdue = task.dueDate && isPast(task.dueDate) && !isToday(task.dueDate) && task.status !== "concluido";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => openTaskModal("view", task.id)}
      className={`bg-[#141414] border border-[#2A2A2A] rounded-lg p-4 shadow-[0_1px_3px_rgba(0,0,0,0.3)] cursor-pointer transition-all duration-[250ms] hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 hover:border-[#3A3A3A] ${
        isDragging ? "rotate-2 shadow-[0_4px_12px_rgba(0,0,0,0.4)]" : ""
      }`}
    >
      {/* Priority left border */}
      <div
        className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
        style={{
          backgroundColor: priorityColors[task.priority],
        }}
      />

      {/* Top row: ID */}
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[11px] font-medium tracking-[0.5px] text-[#5A5A5A] font-mono">
          {task.id}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-[15px] font-semibold text-[#F0F0F0] tracking-[-0.3px] leading-5 line-clamp-2 mb-1.5">
        {task.title}
      </h3>

      {/* Description */}
      {task.description && (
        <p className="text-[13px] text-[#8A8A8A] leading-[18px] line-clamp-2 mb-2">
          {task.description}
        </p>
      )}

      {/* Department badge */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-[0.5px] leading-3"
          style={{
            backgroundColor:
              task.department === "comercial"
                ? "rgba(168, 85, 247, 0.15)"
                : task.department === "financeiro"
                ? "rgba(34, 197, 94, 0.15)"
                : "rgba(242, 201, 76, 0.12)",
            color:
              task.department === "comercial"
                ? "#A855F7"
                : task.department === "financeiro"
                ? "#22C55E"
                : "#F2C94C",
          }}
        >
          {task.department === "comercial"
            ? "Comercial"
            : task.department === "financeiro"
            ? "Financeiro"
            : "Suporte"}
        </span>
        {task.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-[0.5px] leading-3 bg-[#2A2A2A] text-[#8A8A8A]"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2A2A2A]">
        <div className="flex items-center gap-2">
          {/* Assignee avatar */}
          {assignee ? (
            <img
              src={assignee.avatar}
              alt={assignee.name}
              className="w-6 h-6 rounded-full"
              title={assignee.name}
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-[#1E1E1E] border border-dashed border-[#3A3A3A]" />
          )}

          {/* Due date */}
          {task.dueDate && (
            <span
              className={`flex items-center gap-1 text-[11px] font-medium tracking-[0.5px] ${
                isOverdue ? "text-[#EF4444]" : "text-[#5A5A5A]"
              }`}
            >
              <Clock size={12} />
              {format(task.dueDate, "dd/MM", { locale: ptBR })}
            </span>
          )}
        </div>

        {/* Comments & attachments */}
        <div className="flex items-center gap-2 text-[#5A5A5A]">
          {(task.comments?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-[11px]">
              <MessageSquare size={12} />
              {task.comments?.length ?? 0}
            </span>
          )}
          {(task.attachmentsCount ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-[11px]">
              <Paperclip size={12} />
              {task.attachmentsCount ?? 0}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
