import type { Kanban, KanbanColumn, Task, User } from "@/types";

export const COLUMN_KIND_LABELS = { normal: "Normal", completed: "Concluída", blocked: "Bloqueada" };

export function slugify(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function uniqueKanbanSlug(name: string, kanbans: Kanban[]): string {
  const base = slugify(name);
  if (!base) return "";
  let slug = base;
  let suffix = 2;
  while (kanbans.some((kanban) => kanban.slug === slug)) slug = `${base}-${suffix++}`;
  return slug;
}

export function uniqueColumnKey(name: string, columns: KanbanColumn[], kanbanId: string): string {
  const base = slugify(name) || "coluna";
  let key = base;
  let suffix = 2;
  while (columns.some((column) => column.kanbanId === kanbanId && column.key === key)) key = `${base}-${suffix++}`;
  return key;
}

export function sortColumns(columns: KanbanColumn[]): KanbanColumn[] {
  return [...columns].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

export const selectActiveKanban = (state: { kanbans: Kanban[]; activeKanbanId: string | null }) =>
  state.kanbans.find((kanban) => kanban.id === state.activeKanbanId) ?? null;

export function isTaskCompleted(task: Pick<Task, "kanbanId" | "columnId">, columns: KanbanColumn[]): boolean {
  return columns.some((column) => column.id === task.columnId && column.kanbanId === task.kanbanId && column.kind === "completed");
}

export function isTaskBlocked(task: Pick<Task, "kanbanId" | "columnId">, columns: KanbanColumn[]): boolean {
  return columns.some((column) => column.id === task.columnId && column.kanbanId === task.kanbanId && column.kind === "blocked");
}

export function getKanbanPermissions(currentUser: User | null, columns: KanbanColumn[]) {
  const role = currentUser?.role;
  const supervisor = role === "supervisor_geral" || role === "supervisor_adjunto";
  const ordered = sortColumns(columns);
  const normal = ordered.filter((column) => column.kind === "normal");
  const initialColumnId = normal[0]?.id;
  const workColumnId = normal[1]?.id ?? initialColumnId;
  const canCreateInColumn = (columnId: string): boolean => {
    const column = columns.find((entry) => entry.id === columnId);
    if (!role || !column) return false;
    if (supervisor) return true;
    if (role === "tecnico") return columnId === workColumnId || column.kind === "completed";
    if (role === "estagiario") return columnId === workColumnId;
    return columnId === initialColumnId;
  };
  const canEditTask = (creatorId?: string, assigneeId?: string | null): boolean => {
    if (!currentUser) return false;
    if (supervisor || creatorId === currentUser.id) return true;
    return (role === "tecnico" || role === "estagiario") && assigneeId === currentUser.id;
  };
  const canMoveToColumn = (fromColumnId: string, toColumnId: string): boolean => {
    if (!role) return false;
    const from = ordered.find((column) => column.id === fromColumnId);
    const to = ordered.find((column) => column.id === toColumnId);
    if (!from || !to || from.kanbanId !== to.kanbanId) return false;
    if (role === "supervisor_geral") return true;
    if (role === "supervisor_adjunto") return to.kind !== "blocked";
    return from.kind === "blocked" || ordered.indexOf(to) >= ordered.indexOf(from);
  };
  return {
    canCreateTask: () => ordered.some((column) => canCreateInColumn(column.id)),
    canCreateInColumn, canEditTask,
    canEditTaskModal: () => supervisor,
    canMoveToColumn,
    canViewEquipe: supervisor || role === "tecnico",
    canViewRelatorios: supervisor,
    canManageUsers: role === "supervisor_geral",
    canManageKanbans: supervisor,
    canViewClientes: supervisor,
    canDeleteTask: supervisor,
    canBatchEdit: supervisor,
    canArchiveTask: () => supervisor,
  };
}
