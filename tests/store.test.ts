import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Kanban, KanbanColumn, Task, User } from "@/types";

type Query = { table: string; filters: Record<string, unknown>; offset: number; end: number; operation: string };
type Response = { data: unknown; error: { message: string } | null };
const mock = vi.hoisted(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  return { queries: [] as Query[], handlers: [] as { options: Record<string, string>; callback: (payload: { old: { id: string } }) => void }[], response: async (query: Query): Promise<Response> => { void query; return { data: [], error: null }; }, removed: vi.fn() };
});
vi.mock("@/utils/supabase", () => {
  const supabase = {
    auth: { onAuthStateChange: vi.fn() },
    rpc(name: string, filters: Record<string, unknown>) { const query = { table: `rpc:${name}`, filters, offset: 0, end: 0, operation: "rpc" }; mock.queries.push(query); return mock.response(query); },
    functions: { invoke(name: string) { return mock.response({ table: `function:${name}`, filters: {}, offset: 0, end: 0, operation: "invoke" }); } },
    from(table: string) {
      const query: Query = { table, filters: {}, offset: 0, end: 499, operation: "select" };
      const builder = {
        select() { return builder; }, order() { return builder; }, single() { return builder; },
        eq(key: string, value: unknown) { query.filters[key] = value; return builder; },
        range(offset: number, end: number) { query.offset = offset; query.end = end; return builder; },
        insert() { query.operation = "insert"; return builder; }, update() { query.operation = "update"; return builder; }, delete() { query.operation = "delete"; return builder; },
        then(resolve: (value: Response) => unknown, reject: (reason: unknown) => unknown) { mock.queries.push(query); return mock.response(query).then(resolve, reject); },
      };
      return builder;
    },
    channel() {
      const channel = { on(_event: string, options: Record<string, string>, callback: (payload: { old: { id: string } }) => void) { mock.handlers.push({ options, callback }); return channel; }, subscribe() { return channel; } };
      return channel;
    }, removeChannel: mock.removed,
  };
  return { supabase };
});
import { useStore } from "@/store/useStore";

const kanbans = ["a", "b"].map((id) => ({ id, slug: id, name: id, position: 0, color: "#123456", taskCount: 0, createdBy: null, createdAt: new Date() })) as Kanban[];
const user: User = { id: "user", name: "User", email: "user@example.test", role: "supervisor_geral", department: "suporte", avatar: "", createdAt: new Date() };
const columnRow = (id: string) => ({ id: `${id}-column`, kanban_id: id, key: "arbitrary", name: id, kind: "normal", color: "#123456", position: 0, created_at: new Date().toISOString() });
const taskRow = (kanban: string, id = `${kanban}-task`) => ({ id, kanban_id: kanban, column_id: `${kanban}-column`, creator_id: "user", title: kanban, description: "", priority: "medium", department: "suporte", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), assignee_id: null, due_date: null });
const column: KanbanColumn = { id: "a-column", kanbanId: "a", key: "arbitrary", name: "Aberto", kind: "normal", position: 0, color: "#123456", createdAt: new Date() };
const task: Task = { id: "a-task", displayId: "", idTask: 1, idRfc: null, title: "A", description: "", priority: "medium", department: "suporte", kanbanId: "a", columnId: column.id, creatorId: user.id, assigneeId: null, customerId: null, dueDate: null, tags: [], attachmentsCount: 0, archived: false, archivedAt: null, createdAt: new Date(), updatedAt: new Date() };

beforeEach(() => {
  useStore.getState().unsubscribeRealtime();
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  mock.queries = []; mock.handlers = []; mock.removed.mockClear();
  mock.response = async (query) => ({ data: query.table === "tasks" ? [taskRow(String(query.filters.kanban_id))] : query.table === "kanban_columns" ? [columnRow(String(query.filters.kanban_id))] : [], error: null });
  useStore.setState({ currentUser: user, isAuthenticated: true, kanbans, activeKanbanId: null, tasks: [], columns: [], scopeLoading: false, scopeError: null, taskModalOpen: false });
});

describe("active Kanban store isolation", () => {
  it("loads only the selected tasks and columns and resets filters, search and modal", async () => {
    useStore.setState({ searchQuery: "old", taskModalOpen: true });
    await useStore.getState().setActiveKanban("a");
    expect(useStore.getState().tasks.map((entry) => entry.kanbanId)).toEqual(["a"]);
    await useStore.getState().setActiveKanban("b");
    expect(useStore.getState().tasks.map((entry) => entry.kanbanId)).toEqual(["b"]);
    expect(useStore.getState().columns.map((entry) => entry.kanbanId)).toEqual(["b"]);
    expect(useStore.getState().searchQuery).toBe(""); expect(useStore.getState().taskModalOpen).toBe(false);
    expect(useStore.getState().filters.columnId).toBe("all");
    expect(mock.queries.every((query) => query.filters.kanban_id === "a" || query.filters.kanban_id === "b")).toBe(true);
    expect(mock.removed).toHaveBeenCalled();
  });

  it("ignores delayed A results after switching A → B → A", async () => {
    let finish: (result: Response) => void = () => {};
    let first = true;
    const response = mock.response;
    mock.response = async (query) => {
      if (query.table === "tasks" && query.filters.kanban_id === "a" && first) {
        first = false; return new Promise((resolve) => { finish = resolve; });
      }
      return response(query);
    };
    const previous = useStore.getState().setActiveKanban("a");
    await vi.waitFor(() => expect(first).toBe(false));
    await useStore.getState().setActiveKanban("b");
    await useStore.getState().setActiveKanban("a");
    finish({ data: [taskRow("a", "stale")], error: null });
    await previous;
    expect(useStore.getState().tasks[0].id).toBe("a-task");
    expect(useStore.getState().scopeLoading).toBe(false);
  });

  it("ignores old Realtime callbacks and filters INSERT/UPDATE by the active Kanban", async () => {
    await useStore.getState().setActiveKanban("a");
    const old = mock.handlers.find((handler) => handler.options.table === "tasks" && handler.options.event === "INSERT")!;
    expect(old.options.filter).toBe("kanban_id=eq.a");
    await useStore.getState().setActiveKanban("b");
    const queryCount = mock.queries.length;
    old.callback({ old: { id: "a-task" } });
    await Promise.resolve();
    expect(mock.queries).toHaveLength(queryCount);
    expect(useStore.getState().tasks[0].kanbanId).toBe("b");
  });

  it("fetches every task beyond Supabase's row limit in scoped batches", async () => {
    mock.response = async (query) => ({ data: query.table === "tasks" ? Array.from({ length: query.offset < 1000 ? 500 : 17 }, (_, index) => taskRow("a", String(query.offset + index))) : [columnRow("a")], error: null });
    await useStore.getState().setActiveKanban("a");
    expect(useStore.getState().tasks).toHaveLength(1017);
    expect(mock.queries.filter((query) => query.table === "tasks").map((query) => query.offset)).toEqual([0, 500, 1000]);
  });

  it("shows fetch failures and allows retry without treating stale failures as current", async () => {
    mock.response = async () => ({ data: null, error: { message: "offline" } });
    await useStore.getState().setActiveKanban("a");
    expect(useStore.getState().scopeError).toBe("offline");
    mock.response = async (query) => ({ data: query.table === "tasks" ? [taskRow("a")] : [columnRow("a")], error: null });
    await useStore.getState().setActiveKanban("a");
    expect(useStore.getState().scopeError).toBeNull();
  });

  it("rejects foreign column creation, editing, dragging and non-completed archiving before any request", async () => {
    useStore.setState({ activeKanbanId: "a", tasks: [task], columns: [column] });
    expect(await useStore.getState().addTask({ ...task, columnId: "b-column" })).toBe(false);
    expect(await useStore.getState().updateTask(task.id, { columnId: "b-column" })).toBe(false);
    expect(await useStore.getState().updateTask(task.id, { kanbanId: "b" })).toBe(false);
    expect(await useStore.getState().moveTask(task.id, "b-column")).toBe(false);
    expect(await useStore.getState().archiveTask(task.id)).toBe(false);
    expect(mock.queries).toEqual([]);
    useStore.getState().openTaskModal("create", undefined, column.id);
    expect(useStore.getState().taskModalDefaultColumnId).toBe(column.id);
  });

  it("requires the exact deleted task ID, preserves state on zero affected rows and scopes the RPC", async () => {
    useStore.setState({ activeKanbanId: "a", tasks: [task], columns: [column], taskModalTaskId: task.id, taskModalOpen: true });
    mock.response = async () => ({ data: null, error: null });
    expect(await useStore.getState().deleteTask(task.id)).toBe(false);
    expect(useStore.getState().tasks).toHaveLength(1); expect(useStore.getState().taskModalOpen).toBe(true);
    expect(mock.queries[0].filters).toEqual({ p_task_id: task.id, p_kanban_id: "a" });
    mock.response = async (query) => ({ data: query.operation === "rpc" ? task.id : [], error: null });
    expect(await useStore.getState().deleteTask(task.id)).toBe(true);
    expect(useStore.getState().tasks).toHaveLength(0); expect(useStore.getState().taskModalOpen).toBe(false);
  });

  it("blocks duplicate task deletion requests and rejects ordinary users before contacting the backend", async () => {
    useStore.setState({ activeKanbanId: "a", tasks: [task], columns: [column] });
    let finish!: (response: Response) => void;
    mock.response = async () => new Promise((resolve) => { finish = resolve; });
    const pending = useStore.getState().deleteTask(task.id);
    expect(await useStore.getState().deleteTask(task.id)).toBe(false);
    expect(mock.queries).toHaveLength(1);
    finish({ data: task.id, error: null }); await pending;
    useStore.setState({ currentUser: { ...user, role: "tecnico" }, tasks: [task] });
    const count = mock.queries.length;
    expect(await useStore.getState().deleteTask(task.id)).toBe(false);
    expect((await useStore.getState().resetMemberPassword(user.id, "test-password")).success).toBe(false);
    expect((await useStore.getState().transferAndDeleteKanban("a", "b", {}, "test-password")).success).toBe(false);
    expect(mock.queries).toHaveLength(count);
  });
});
