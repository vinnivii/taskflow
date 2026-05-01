import { useMemo, useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  ClipboardList,
  Clock,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/AppLayout";
import { FilterBar } from "@/components/FilterBar";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  priorityColors,
  statusColors,
  departmentColors,
  priorityDisplayNames,
  statusDisplayNames,
  departmentDisplayNames,
} from "@/types";
import type { Task, TaskPriority, TaskStatus, Department } from "@/types";

type SortColumn = "title" | "assignee" | "department" | "priority" | "status" | "dueDate" | null;
type SortDirection = "asc" | "desc";

export function Tarefas() {
  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const filters = useStore((s) => s.filters);
  const searchQuery = useStore((s) => s.searchQuery);
  const openTaskModal = useStore((s) => s.openTaskModal);
  const unarchiveTask = useStore((s) => s.unarchiveTask);
  const addToast = useStore((s) => s.addToast);
  const perms = usePermissions();
  const isMobile = useIsMobile();

  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [unarchiveDialogOpen, setUnarchiveDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const perPage = 20;

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === "asc") setSortDirection("desc");
      else {
        setSortColumn(null);
        setSortDirection("asc");
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (filters.department !== "all") {
      result = result.filter((t) => t.department === filters.department);
    }
    if (filters.priority !== "all") {
      result = result.filter((t) => t.priority === filters.priority);
    }
    if (filters.status !== "all") {
      result = result.filter((t) => t.status === filters.status);
    }
    if (filters.assignee === "me") {
      const currentUserId = useStore.getState().currentUser?.id;
      result = result.filter((t) => t.assigneeId === currentUserId);
    }
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

    if (sortColumn) {
      result.sort((a, b) => {
        let cmp = 0;
        switch (sortColumn) {
          case "title":
            cmp = a.title.localeCompare(b.title);
            break;
          case "assignee":
            cmp = (a.assigneeId || "").localeCompare(b.assigneeId || "");
            break;
          case "department":
            cmp = a.department.localeCompare(b.department);
            break;
          case "priority": {
            const order = ["urgent", "high", "medium", "low"];
            cmp = order.indexOf(a.priority) - order.indexOf(b.priority);
            break;
          }
          case "status": {
            const order = ["novo", "em_andamento", "em_revisao", "concluido", "bloqueado"];
            cmp = order.indexOf(a.status) - order.indexOf(b.status);
            break;
          }
          case "dueDate":
            cmp = (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0);
            break;
        }
        return sortDirection === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [tasks, filters, searchQuery, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / perPage));
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  const formatDueDate = (task: Task) => {
    if (!task.dueDate) return "—";
    if (isToday(task.dueDate)) return <span className="text-[#EF4444]">Hoje</span>;
    if (isPast(task.dueDate) && task.status !== "concluido")
      return (
        <span className="text-[#EF4444] flex items-center gap-1">
          <AlertTriangle size={12} /> Atrasado
        </span>
      );
    return format(task.dueDate, "dd/MM/yyyy", { locale: ptBR });
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null;
    return sortDirection === "asc" ? (
      <ChevronUp size={12} className="text-[var(--c-muted-2)]" />
    ) : (
      <ChevronDown size={12} className="text-[var(--c-muted-2)]" />
    );
  };

  const columns = [
    { id: "title" as SortColumn, label: "Tarefa" },
    { id: "assignee" as SortColumn, label: "Responsavel" },
    { id: "department" as SortColumn, label: "Setor" },
    { id: "priority" as SortColumn, label: "Prioridade" },
    { id: "status" as SortColumn, label: "Status" },
    { id: "dueDate" as SortColumn, label: "Prazo" },
  ];

  if (isMobile) {
    return (
      <AppLayout title="Tarefas">
        <div className="mb-4">
          <FilterBar />
        </div>
        <div className="flex flex-col gap-2">
          {paginatedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList size={32} className="text-[var(--c-muted-3)] mb-3" />
              <p className="text-[var(--c-muted-2)] text-[14px]">Nenhuma tarefa encontrada</p>
            </div>
          ) : paginatedTasks.map((task) => {
            const assignee = users.find((u) => u.id === task.assigneeId) ?? null;
            const isOverdue = task.dueDate && isPast(task.dueDate) && !isToday(task.dueDate) && task.status !== "concluido";
            return (
              <div
                key={task.id}
                onClick={() => openTaskModal("view", task.id)}
                className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl p-4 cursor-pointer active:bg-[var(--c-surface-2)] transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-[var(--c-muted-2)]">#{task.idTask}{task.idRfc ? ` · RFC-${task.idRfc}` : ""}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: `${statusColors[task.status]}20`, color: statusColors[task.status] }}>
                    {statusDisplayNames[task.status]}
                  </span>
                </div>
                <p className="text-[14px] font-semibold text-[var(--c-text)] leading-snug mb-2 line-clamp-2">{task.title}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: `${priorityColors[task.priority]}20`, color: priorityColors[task.priority] }}>
                    {priorityDisplayNames[task.priority]}
                  </span>
                  <div className="flex items-center gap-2">
                    {task.dueDate && (
                      <span className={`flex items-center gap-1 text-[11px] ${isOverdue ? "text-[#EF4444]" : "text-[var(--c-muted-2)]"}`}>
                        <Clock size={11} />
                        {format(task.dueDate, "dd/MM", { locale: ptBR })}
                      </span>
                    )}
                    {assignee && <img src={assignee.avatar} alt={assignee.name} className="w-6 h-6 rounded-full" title={assignee.name} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 gap-3">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex-1 h-10 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg text-[13px] text-[var(--c-muted)] disabled:opacity-40 transition-colors"
            >
              Anterior
            </button>
            <span className="text-[12px] text-[var(--c-muted-2)] shrink-0">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex-1 h-10 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg text-[13px] text-[var(--c-muted)] disabled:opacity-40 transition-colors"
            >
              Próximo
            </button>
          </div>
        )}
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Tarefas">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[24px] font-semibold text-[var(--c-text)] tracking-[-0.8px]">
            Tarefas
          </h1>
          <span className="text-[13px] text-[var(--c-muted)]">
            Mostrando {Math.min(paginatedTasks.length, perPage)} de {filteredTasks.length} tarefas
          </span>
        </div>
      </div>

      <div className="mb-5">
        <FilterBar showStatusFilter />
      </div>

      {filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <ClipboardList size={64} className="text-[var(--c-muted-2)] mb-4" />
          <h2 className="text-[18px] font-semibold text-[var(--c-muted)] tracking-[-0.5px]">
            Nenhuma tarefa encontrada
          </h2>
          <p className="text-[13px] text-[var(--c-muted-2)] mt-2">
            Tente ajustar os filtros ou criar uma nova tarefa
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[var(--c-border)]">
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      onClick={() => handleSort(col.id)}
                      className="text-left text-[11px] font-medium tracking-[0.5px] text-[var(--c-muted)] uppercase py-3 px-4 cursor-pointer hover:text-[var(--c-text)] transition-colors select-none whitespace-nowrap"
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        <SortIcon column={col.id} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedTasks.map((task, index) => {
                  const assignee = users.find((u) => u.id === task.assigneeId) ?? null;
                  return (
                    <tr
                      key={task.id}
                      onClick={() => openTaskModal("view", task.id)}
                      className={`border-b border-[var(--c-border)] cursor-pointer transition-colors hover:bg-[var(--c-surface-3)] ${
                        index % 2 === 1 ? "bg-[rgba(255,255,255,0.02)]" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="text-[14px] text-[var(--c-text)] font-medium truncate max-w-[280px]">
                          {task.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-[var(--c-muted-2)] font-mono">#{task.idTask}</span>
                          {task.idRfc && (
                            <span className="text-[10px] font-semibold font-mono px-1.5 py-0.5 rounded bg-[var(--c-surface-3)] text-[var(--c-muted)]">
                              RFC-{task.idRfc}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {assignee ? (
                            <>
                              <img
                                src={assignee.avatar}
                                alt={assignee.name}
                                className="w-6 h-6 rounded-full"
                              />
                              <span className="text-[13px] text-[var(--c-muted)]">
                                {assignee.name.split(" ")[0]}
                              </span>
                            </>
                          ) : (
                            <span className="text-[13px] text-[var(--c-muted-2)]">Nao atribuido</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-[0.5px]"
                          style={{
                            backgroundColor:
                              task.department === "comercial"
                                ? "rgba(168, 85, 247, 0.15)"
                                : task.department === "financeiro"
                                ? "rgba(34, 197, 94, 0.15)"
                                : "rgba(242, 201, 76, 0.12)",
                            color: departmentColors[task.department],
                          }}
                        >
                          {departmentDisplayNames[task.department]}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: priorityColors[task.priority] }}
                          />
                          <span className="text-[13px] text-[var(--c-muted)]">
                            {priorityDisplayNames[task.priority]}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-[0.5px]"
                            style={{
                              backgroundColor: `${statusColors[task.status]}26`,
                              color: statusColors[task.status],
                            }}
                          >
                            {statusDisplayNames[task.status]}
                          </span>

                          {task.archived && (
                            perms.canArchiveTask() ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedTaskId(task.id);
                                  setUnarchiveDialogOpen(true);
                                }}
                                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-[0.5px] bg-[var(--c-surface-3)] text-[var(--c-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] transition-colors"
                                title="Clique para desarquivar"
                              >
                                Arquivada
                              </button>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-[0.5px] bg-[var(--c-surface-3)] text-[var(--c-muted)]">
                                Arquivada
                              </span>
                            )
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[13px] text-[var(--c-muted-2)] whitespace-nowrap">
                        {formatDueDate(task)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <AlertDialog
            open={unarchiveDialogOpen}
            onOpenChange={(open) => {
              setUnarchiveDialogOpen(open);
              if (!open) setSelectedTaskId(null);
            }}
          >
            <AlertDialogContent
              onClick={(e) => {
                // Prevent row click behind the dialog
                e.stopPropagation();
              }}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>Desarquivar tarefa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ao desarquivar, a tarefa volta a aparecer no quadro Kanban.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    if (!selectedTaskId) return;
                    const ok = await unarchiveTask(selectedTaskId);
                    if (ok) {
                      addToast({
                        type: "success",
                        title: "Tarefa desarquivada",
                        message: "Ela voltou a aparecer no quadro.",
                      });
                    }
                    setUnarchiveDialogOpen(false);
                    setSelectedTaskId(null);
                  }}
                >
                  Desarquivar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-9 px-3 bg-[var(--c-surface-3)] border border-[var(--c-border)] text-[var(--c-muted)] text-[13px] rounded-md hover:bg-[var(--c-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-9 h-9 text-[11px] font-medium rounded-md transition-colors ${
                    page === currentPage
                      ? "bg-[#F2C94C] text-[#0A0A0A]"
                      : "bg-[var(--c-surface-3)] border border-[var(--c-border)] text-[var(--c-muted)] hover:bg-[var(--c-hover)]"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-9 px-3 bg-[var(--c-surface-3)] border border-[var(--c-border)] text-[var(--c-muted)] text-[13px] rounded-md hover:bg-[var(--c-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Proxima
              </button>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
