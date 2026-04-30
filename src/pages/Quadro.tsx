import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { FilterBar } from "@/components/FilterBar";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCard } from "@/components/KanbanCard";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";
import { statusOrder, statusColors, statusDisplayNames } from "@/types";
import type { Task, TaskStatus } from "@/types";

export function Quadro() {
  const tasks = useStore((s) => s.tasks);
  const filters = useStore((s) => s.filters);
  const searchQuery = useStore((s) => s.searchQuery);
  const moveTask = useStore((s) => s.moveTask);
  const openTaskModal = useStore((s) => s.openTaskModal);
  const addToast = useStore((s) => s.addToast);
  const perms = usePermissions();

  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const boardRef = useRef<HTMLDivElement>(null);

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Archived tasks should not appear on the Kanban board
    result = result.filter((t) => !t.archived);

    // Department filter
    if (filters.department !== "all") {
      result = result.filter((t) => t.department === filters.department);
    }

    // Priority filter
    if (filters.priority !== "all") {
      result = result.filter((t) => t.priority === filters.priority);
    }

    // Assignee filter
    if (filters.assignee === "me") {
      const currentUserId = useStore.getState().currentUser?.id;
      result = result.filter((t) => t.assigneeId === currentUserId);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }

    // Sort by priority then date
    const priorityOrder = ["urgent", "high", "medium", "low"];
    result.sort((a, b) => {
      const pa = priorityOrder.indexOf(a.priority);
      const pb = priorityOrder.indexOf(b.priority);
      if (pa !== pb) return pa - pb;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return result;
  }, [tasks, filters, searchQuery]);

  // Group by status
  const tasksByColumn = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      novo: [],
      em_andamento: [],
      em_revisao: [],
      concluido: [],
      bloqueado: [],
    };
    for (const task of filteredTasks) {
      grouped[task.status].push(task);
    }
    return grouped;
  }, [filteredTasks]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }, [tasks]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);

      if (!over) return;

      const taskId = active.id as string;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const newStatus = over.id as TaskStatus;

      // Check if status actually changed
      if (task.status === newStatus) return;

      // Check permission
      if (!perms.canMoveToColumn(task.status, newStatus)) {
        addToast({
          type: "error",
          title: "Permissao insuficiente",
          message: `Voce nao pode mover de ${statusDisplayNames[task.status]} para ${statusDisplayNames[newStatus]}`,
        });
        return;
      }

      moveTask(taskId, newStatus);
      addToast({
        type: "success",
        title: "Tarefa movida",
        message: `Movida para ${statusDisplayNames[newStatus]}`,
      });
    },
    [tasks, perms, moveTask, addToast]
  );

  // Horizontal scroll with mouse wheel (Shift key)
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const handleWheel = (e: WheelEvent) => {
      // Only convert vertical scroll to horizontal if Shift is held
      if (e.shiftKey && Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        board.scrollLeft += e.deltaY;
      }
    };

    board.addEventListener("wheel", handleWheel, { passive: false });
    return () => board.removeEventListener("wheel", handleWheel);
  }, []);

  const totalTasks = filteredTasks.length;

  return (
    <AppLayout title="Quadro">
      <div className="flex flex-col h-full">
        {/* Page header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] font-semibold text-[var(--c-text)] tracking-[-0.8px]">
              Quadro
            </h1>
            <span className="text-[13px] text-[var(--c-muted)]">
              ({totalTasks} {totalTasks === 1 ? "tarefa" : "tarefas"})
            </span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mb-5">
          <FilterBar />
        </div>

        {/* Kanban Board */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            ref={boardRef}
            className="flex gap-4 overflow-x-auto overflow-y-auto pb-6 flex-1 custom-scrollbar"
          >
            {statusOrder.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={tasksByColumn[status]}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{
            duration: 220,
            easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
          }}>
            {activeTask ? (
              <div
                style={{
                  transform: "rotate(3deg) scale(1.04)",
                  boxShadow: "0 24px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(242,201,76,0.15)",
                  borderRadius: "0.5rem",
                  opacity: 0.96,
                  cursor: "grabbing",
                }}
              >
                <KanbanCard task={activeTask} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </AppLayout>
  );
}
