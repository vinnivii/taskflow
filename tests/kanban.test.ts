import { describe, expect, it } from "vitest";
import { getKanbanPermissions, isTaskBlocked, isTaskCompleted, slugify, sortColumns, uniqueKanbanSlug, uniqueColumnKey } from "@/lib/kanban";
import type { Kanban, KanbanColumn, User, UserRole } from "@/types";

export const columns: KanbanColumn[] = [
  { id: "initial", kanbanId: "a", key: "fila", name: "Aguardando", kind: "normal", position: 0, color: "#123456", createdAt: new Date() },
  { id: "work", kanbanId: "a", key: "execucao", name: "Desenvolvimento", kind: "normal", position: 1, color: "#123456", createdAt: new Date() },
  { id: "review", kanbanId: "a", key: "homologacao", name: "Homologação", kind: "normal", position: 2, color: "#123456", createdAt: new Date() },
  { id: "done", kanbanId: "a", key: "finalizado", name: "Finalizado", kind: "completed", position: 3, color: "#123456", createdAt: new Date() },
  { id: "blocked", kanbanId: "a", key: "impedido", name: "Impedido", kind: "blocked", position: 4, color: "#123456", createdAt: new Date() },
];
const user = (role: UserRole): User => ({ id: "user", role, department: "suporte", name: "Test", email: "test@example.test", avatar: "", createdAt: new Date() });

describe("generic workflows", () => {
  it("reserves unique column keys within a Kanban and supports names without ASCII letters", () => {
    const existing = [{ ...columns[0], key: "revisao" }, { ...columns[0], id: "second", key: "revisao-2" }, { ...columns[0], kanbanId: "b", key: "revisao-3" }];
    expect(uniqueColumnKey("Revisão!", existing, "a")).toBe("revisao-3");
    expect(uniqueColumnKey("Revisão!", existing, "b")).toBe("revisao");
    expect(uniqueColumnKey("☀", [{ ...columns[0], key: "coluna" }], "a")).toBe("coluna-2");
  });
  it("normalizes accented names and reserves unique safe slugs", () => {
    expect(slugify(" Desenvolvimento Interno! ")).toBe("desenvolvimento-interno");
    expect(slugify("Operação & Revisão")).toBe("operacao-revisao");
    expect(uniqueKanbanSlug("Principal", [{ slug: "principal" }, { slug: "principal-2" }] as Kanban[])).toBe("principal-3");
  });
  it("finds completion and blocked state by kind and validates both IDs", () => {
    expect(isTaskCompleted({ columnId: "done", kanbanId: "a" }, columns)).toBe(true);
    expect(isTaskCompleted({ columnId: "done", kanbanId: "b" }, columns)).toBe(false);
    expect(isTaskBlocked({ columnId: "blocked", kanbanId: "a" }, columns)).toBe(true);
    expect(isTaskCompleted({ columnId: "missing", kanbanId: "a" }, columns)).toBe(false);
  });
  it.each([
    ["supervisor_geral", ["initial", "work", "review", "done", "blocked"]],
    ["supervisor_adjunto", ["initial", "work", "review", "done", "blocked"]],
    ["tecnico", ["work", "done"]], ["estagiario", ["work"]],
    ["comercial", ["initial"]], ["financeiro", ["initial"]],
  ] as [UserRole, string[]][])("preserves Principal creation rules for %s with custom keys", (role, expected) => {
    const permissions = getKanbanPermissions(user(role), columns);
    expect(columns.filter((column) => permissions.canCreateInColumn(column.id)).map((column) => column.id)).toEqual(expected);
    expect(permissions.canManageKanbans).toBe(role.startsWith("supervisor"));
  });
  it("uses position for forward movement and kind for blocked restrictions", () => {
    const ordinary = getKanbanPermissions(user("tecnico"), columns);
    expect(ordinary.canMoveToColumn("work", "review")).toBe(true);
    expect(ordinary.canMoveToColumn("review", "work")).toBe(false);
    expect(ordinary.canMoveToColumn("blocked", "initial")).toBe(true);
    expect(getKanbanPermissions(user("supervisor_adjunto"), columns).canMoveToColumn("work", "blocked")).toBe(false);
    expect(getKanbanPermissions(user("supervisor_geral"), columns).canMoveToColumn("blocked", "initial")).toBe(true);
    const reordered = sortColumns(columns.map((column) => ({ ...column, position: -column.position })));
    expect(reordered[0].id).toBe("blocked");
    expect(getKanbanPermissions(user("tecnico"), reordered).canMoveToColumn("review", "work")).toBe(true);
  });
  it("rejects cross-Kanban moves for every role and supports a single normal column", () => {
    const foreign = { ...columns[0], id: "foreign", kanbanId: "b" };
    for (const role of ["supervisor_geral", "supervisor_adjunto", "tecnico", "estagiario", "comercial", "financeiro"] as UserRole[]) {
      expect(getKanbanPermissions(user(role), [...columns, foreign]).canMoveToColumn("initial", "foreign")).toBe(false);
    }
    expect(getKanbanPermissions(user("tecnico"), [columns[0]]).canCreateInColumn("initial")).toBe(true);
    expect(getKanbanPermissions(null, columns).canCreateTask()).toBe(false);
  });
});
