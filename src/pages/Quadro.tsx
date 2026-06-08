import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ExternalLink, Plus } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { FilterBar } from "@/components/FilterBar";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCard } from "@/components/KanbanCard";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Task, TaskStatus } from "@/types";

const MONITOR_URL = "https://monitoramento-softcomshop.softcomapps.com/status/monitor";
const MONITOR_API_URL = "https://monitoramento-softcomshop.softcomapps.com/api/status-page/monitor";
const MONITOR_HEARTBEAT_URL = "https://monitoramento-softcomshop.softcomapps.com/api/status-page/heartbeat/monitor";
const MONITOR_BAR_COUNT = 12;

interface MonitorService {
  id: number;
  name: string;
  uptime: number;
  bars: boolean[];
}

interface StatusPageMonitor {
  id: number;
  name: string;
}

interface StatusPageGroup {
  monitorList?: StatusPageMonitor[];
}

interface StatusPageResponse {
  publicGroupList?: StatusPageGroup[];
}

interface Heartbeat {
  status?: number;
}

interface HeartbeatResponse {
  heartbeatList?: Record<string, Heartbeat[]>;
  uptimeList?: Record<string, number>;
}

const FALLBACK_MONITOR_SERVICES: MonitorService[] = [
  { id: 5, name: "AWS - Stack 1", uptime: 99.98, bars: Array(MONITOR_BAR_COUNT).fill(true) },
  { id: 4, name: "Glaçaí", uptime: 100, bars: Array(MONITOR_BAR_COUNT).fill(true) },
  { id: 3, name: "Servidor Antigo", uptime: 100, bars: Array(MONITOR_BAR_COUNT).fill(true) },
  { id: 1, name: "Servidor Novo", uptime: 100, bars: Array(MONITOR_BAR_COUNT).fill(true) },
];

function formatUptime(value: number) {
  return value === 100 ? "100%" : `${value.toFixed(2)}%`;
}

function buildBars(heartbeats: Heartbeat[] | undefined) {
  const bars = heartbeats
    ?.slice(-MONITOR_BAR_COUNT)
    .map((heartbeat) => heartbeat.status === 1) ?? [];

  return [
    ...Array(Math.max(0, MONITOR_BAR_COUNT - bars.length)).fill(true),
    ...bars,
  ];
}

function getUptimeFromHeartbeats(heartbeats: Heartbeat[] | undefined) {
  if (!heartbeats?.length) return 100;
  const upCount = heartbeats.filter((heartbeat) => heartbeat.status === 1).length;
  return Number(((upCount / heartbeats.length) * 100).toFixed(2));
}

function ServiceMonitor() {
  const [services, setServices] = useState<MonitorService[]>(FALLBACK_MONITOR_SERVICES);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchMonitor = async () => {
      try {
        const [statusPageRes, heartbeatRes] = await Promise.all([
          fetch(MONITOR_API_URL),
          fetch(MONITOR_HEARTBEAT_URL),
        ]);

        if (!statusPageRes.ok || !heartbeatRes.ok) return;

        const statusPage = await statusPageRes.json() as StatusPageResponse;
        const heartbeatData = await heartbeatRes.json() as HeartbeatResponse;

        const monitors = statusPage.publicGroupList
          ?.flatMap((group) => group.monitorList ?? [])
          .filter((monitor) => monitor.name)
          .slice(0, 4) ?? [];

        if (cancelled || monitors.length === 0) return;

        setServices(monitors.map((monitor) => {
          const monitorKey = String(monitor.id);
          const heartbeats = heartbeatData.heartbeatList?.[monitorKey];
          const uptimeValue = heartbeatData.uptimeList?.[`${monitor.id}_24`] ?? getUptimeFromHeartbeats(heartbeats);

          return {
            id: monitor.id,
            name: monitor.name,
            uptime: Number((uptimeValue * (uptimeValue <= 1 ? 100 : 1)).toFixed(2)),
            bars: buildBars(heartbeats),
          };
        }));
        setLastUpdatedAt(new Date());
      } catch {
        // Mantem o desenho de fallback quando a API pública bloquear CORS ou estiver indisponível.
      }
    };

    void fetchMonitor();
    const intervalId = window.setInterval(fetchMonitor, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const updateLabel = lastUpdatedAt
    ? `Atualizado ${lastUpdatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : "Aguardando atualização";

  return (
    <section
      className="hidden h-12 max-w-[820px] shrink items-center gap-3 overflow-hidden rounded-md border border-[#151B24] bg-[#0D1117] px-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] xl:flex"
      title={updateLabel}
    >
      <div className="grid min-w-0 flex-1 grid-cols-4 gap-3">
        {services.map((service) => (
          <div
            key={service.id}
            className="min-w-0 rounded bg-white/[0.025] px-2.5 py-1.5"
            title={`${service.name} - ${formatUptime(service.uptime)} - ${updateLabel}`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex h-5 min-w-[56px] shrink-0 items-center justify-center rounded-full bg-[#62E88E] px-2 text-[10px] font-bold leading-none text-[#05110A]">
                {formatUptime(service.uptime)}
              </span>
              <span className="min-w-0 truncate text-[12px] font-semibold text-[#DCE7FF]">
                {service.name}
              </span>
            </div>
            <div className="mt-1 flex h-2.5 min-w-0 items-center justify-between gap-[3px] overflow-hidden">
              {service.bars.map((isUp, index) => (
                <span
                  key={`${service.id}-${index}`}
                  className={`h-2.5 flex-1 rounded-full ${isUp ? "bg-[#62E88E]" : "bg-[#EF4444]"}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <a
        href={MONITOR_URL}
        target="_blank"
        rel="noreferrer"
        title="Abrir monitoramento"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#7D8796] transition-colors hover:bg-white/5 hover:text-[#DCE7FF]"
      >
        <ExternalLink size={14} />
      </a>
    </section>
  );
}

function MobileStatusTab({
  status, count, isActive, isDragging, onClick, color, label,
}: {
  status: TaskStatus; count: number; isActive: boolean; isDragging: boolean; onClick: () => void; color: string; label: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
      style={{
        background: isOver
          ? color
          : isActive
          ? color
          : isDragging
          ? `${color}30`
          : "var(--c-surface-3)",
        color: isOver || isActive ? "#fff" : isDragging ? color : "var(--c-muted)" as string,
        outline: isOver ? `2px solid ${color}` : undefined,
        transform: isOver ? "scale(1.06)" : undefined,
      }}
    >
      {label} ({count})
    </button>
  );
}

export function Quadro() {
  const tasks = useStore((s) => s.tasks);
  const filters = useStore((s) => s.filters);
  const searchQuery = useStore((s) => s.searchQuery);
  const moveTask = useStore((s) => s.moveTask);
  const openTaskModal = useStore((s) => s.openTaskModal);
  const addToast = useStore((s) => s.addToast);
  const perms = usePermissions();

  const boards = useStore((s) => s.boards);
  const statusDisplayNames = Object.fromEntries(boards.map((b) => [b.key, b.name]));

  const isMobile = useIsMobile();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<TaskStatus>(boards[0]?.key ?? "novo");

  useEffect(() => {
    if (boards.length > 0 && !boards.find((b) => b.key === activeColumn)) {
      setActiveColumn(boards[0].key);
    }
  }, [boards]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
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
      const q = searchQuery.trim().toLowerCase();
      if (/^#\d+$/.test(q)) {
        const num = parseInt(q.slice(1), 10);
        result = result.filter((t) => t.idTask === num);
      } else if (/^rfc[-\s]?\d+$/i.test(q)) {
        const num = parseInt(q.replace(/^rfc[-\s]?/i, ""), 10);
        result = result.filter((t) => t.idRfc === num);
      } else if (/^\d+$/.test(q)) {
        const num = parseInt(q, 10);
        result = result.filter(
          (t) =>
            t.idTask === num ||
            t.idRfc === num ||
            t.title.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q)
        );
      } else {
        result = result.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q)
        );
      }
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
    const grouped: Record<string, Task[]> = {};
    for (const b of boards) grouped[b.key] = [];
    for (const task of filteredTasks) {
      if (!grouped[task.status]) grouped[task.status] = [];
      grouped[task.status].push(task);
    }
    return grouped;
  }, [filteredTasks, boards]);

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

  if (isMobile) {
    return (
      <AppLayout title="Quadro">
        <div className="flex flex-col h-full">
          <div className="mb-4">
            <FilterBar />
          </div>
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {/* Status tabs — also act as drop zones when dragging */}
            <div className="flex overflow-x-auto gap-2 pb-3 mb-4 scrollbar-none">
              {boards.map((b) => (
                <MobileStatusTab
                  key={b.key}
                  status={b.key}
                  count={tasksByColumn[b.key]?.length ?? 0}
                  isActive={activeColumn === b.key}
                  isDragging={!!activeTask}
                  onClick={() => setActiveColumn(b.key)}
                  color={b.color}
                  label={b.name}
                />
              ))}
            </div>
            {/* Single column view */}
            <div className="flex flex-col gap-3 pb-20 overflow-y-auto flex-1">
              {(tasksByColumn[activeColumn] ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="text-[var(--c-muted-2)] text-[13px]">Nenhuma tarefa</div>
                  {perms.canCreateInColumn(activeColumn) && (
                    <button
                      onClick={() => openTaskModal("create", null, activeColumn)}
                      className="mt-3 text-[#F2C94C] text-[12px] font-medium hover:underline"
                    >
                      Criar tarefa
                    </button>
                  )}
                </div>
              ) : (
                (tasksByColumn[activeColumn] ?? []).map((task) => (
                  <KanbanCard key={task.id} task={task} />
                ))
              )}
            </div>
            <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
              {activeTask ? (
                <div style={{ transform: "scale(1.03)", opacity: 0.95 }}>
                  <KanbanCard task={activeTask} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
          {perms.canCreateInColumn(activeColumn) && (
            <button
              onClick={() => openTaskModal("create", null, activeColumn)}
              className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#F2C94C] text-[#0A0A0A] flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:bg-[#F5D76A] transition-colors z-20"
            >
              <Plus size={24} />
            </button>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Quadro">
      <div className="flex flex-col h-full">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] font-semibold text-[var(--c-text)] tracking-[-0.8px]">
              Quadro
            </h1>
            <span className="text-[13px] text-[var(--c-muted)]">
              ({totalTasks} {totalTasks === 1 ? "tarefa" : "tarefas"})
            </span>
          </div>
          <ServiceMonitor />
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
            {boards.map(({ key }) => (
              <KanbanColumn
                key={key}
                status={key}
                tasks={tasksByColumn[key] ?? []}
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
