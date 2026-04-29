import { create } from "zustand";
import type {
  User,
  Task,
  ToastMessage,
  TaskStatus,
  TaskPriority,
  Department,
} from "@/types";
import { mockUsers } from "@/data/mockData";
import { supabase } from "@/utils/supabase";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string | null | undefined) =>
  typeof value === "string" && UUID_REGEX.test(value);

type TaskRow = {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  department: Department;
  assignee_id: string | null;
  creator_id: string;
  due_date: string | null;
  tags?: string[] | null;
  comments?: Task["comments"] | null;
  attachments?: number | null;
  activity_log?: Task["activityLog"] | null;
  created_at: string;
  updated_at: string;
};

const toTask = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  description: row.description,
  priority: row.priority,
  status: row.status,
  department: row.department,
  assigneeId: row.assignee_id,
  creatorId: row.creator_id,
  dueDate: row.due_date ? new Date(row.due_date) : null,
  tags: row.tags ?? [],
  comments: (row.comments ?? []).map((comment) => ({
    ...comment,
    createdAt: new Date(comment.createdAt),
  })),
  attachments: row.attachments ?? 0,
  activityLog: (row.activity_log ?? []).map((activity) => ({
    ...activity,
    createdAt: new Date(activity.createdAt),
  })),
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

const toTaskInsert = (task: Task) => ({
  id: task.id,
  title: task.title,
  description: task.description,
  priority: task.priority,
  status: task.status,
  department: task.department,
  assignee_id: isUuid(task.assigneeId) ? task.assigneeId : null,
  creator_id: isUuid(task.creatorId) ? task.creatorId : crypto.randomUUID(),
  due_date: task.dueDate ? task.dueDate.toISOString() : null,
  tags: task.tags,
  comments: task.comments,
  attachments: task.attachments,
  activity_log: task.activityLog,
  created_at: task.createdAt.toISOString(),
  updated_at: task.updatedAt.toISOString(),
});

const toTaskUpdate = (updates: Partial<Task>) => {
  const payload: Record<string, unknown> = {};

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.department !== undefined) payload.department = updates.department;
  if (updates.assigneeId !== undefined) {
    payload.assignee_id = isUuid(updates.assigneeId) ? updates.assigneeId : null;
  }
  if (updates.creatorId !== undefined) payload.creator_id = updates.creatorId;
  if (updates.dueDate !== undefined) {
    payload.due_date = updates.dueDate ? updates.dueDate.toISOString() : null;
  }
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (updates.comments !== undefined) payload.comments = updates.comments;
  if (updates.attachments !== undefined) payload.attachments = updates.attachments;
  if (updates.activityLog !== undefined) payload.activity_log = updates.activityLog;
  payload.updated_at = new Date().toISOString();

  return payload;
};

interface AppState {
  // Auth
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;

  // Tasks
  tasks: Task[];
  fetchTasks: () => Promise<void>;
  addTask: (task: Task) => Promise<boolean>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<boolean>;
  deleteTask: (taskId: string) => Promise<boolean>;
  moveTask: (taskId: string, newStatus: TaskStatus) => Promise<boolean>;

  // Filters
  filters: {
    department: "all" | Department;
    assignee: "all" | "me" | string;
    priority: "all" | TaskPriority;
    status: "all" | TaskStatus;
  };
  setFilter: (
    key: keyof AppState["filters"],
    value: AppState["filters"][keyof AppState["filters"]]
  ) => void;
  clearFilters: () => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Sidebar
  sidebarExpanded: boolean;
  toggleSidebar: () => void;

  // Toasts
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;

  // Task Modal
  taskModalOpen: boolean;
  taskModalMode: "create" | "view" | "edit";
  taskModalTaskId: string | null;
  taskModalDefaultStatus: TaskStatus | null;
  openTaskModal: (
    mode: "create" | "view" | "edit",
    taskId?: string | null,
    defaultStatus?: TaskStatus | null
  ) => void;
  closeTaskModal: () => void;

  // Notifications
  notifications: { id: string; title: string; message: string; read: boolean }[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Auth
  currentUser: null,
  isAuthenticated: false,
  login: (user) => set({ currentUser: user, isAuthenticated: true }),
  logout: () =>
    set({
      currentUser: null,
      isAuthenticated: false,
      tasks: [],
      filters: { department: "all", assignee: "all", priority: "all", status: "all" },
      searchQuery: "",
    }),

  // Tasks
  tasks: [],
  fetchTasks: async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      get().addToast({
        type: "error",
        title: "Erro ao carregar tarefas",
        message: error.message,
      });
      return;
    }

    set({ tasks: (data as TaskRow[]).map(toTask) });
  },
  addTask: async (task) => {
    const { data, error } = await supabase
      .from("tasks")
      .insert(toTaskInsert(task))
      .select("*")
      .single();

    if (error) {
      get().addToast({
        type: "error",
        title: "Erro ao criar tarefa",
        message:
          error.code === "42703"
            ? "A tabela tasks nao possui as colunas de atividade/comentarios. Atualize o schema do banco."
            : error.message,
      });
      return false;
    }

    set((state) => ({ tasks: [toTask(data as TaskRow), ...state.tasks] }));
    return true;
  },
  updateTask: async (taskId, updates) => {
    const { data, error } = await supabase
      .from("tasks")
      .update(toTaskUpdate(updates))
      .eq("id", taskId)
      .select("*")
      .single();

    if (error) {
      get().addToast({
        type: "error",
        title: "Erro ao atualizar tarefa",
        message:
          error.code === "42703"
            ? "A tabela tasks nao possui as colunas de atividade/comentarios. Atualize o schema do banco."
            : error.message,
      });
      return false;
    }

    const updatedTask = toTask(data as TaskRow);
    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === taskId ? updatedTask : task)),
    }));
    return true;
  },
  deleteTask: async (taskId) => {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      get().addToast({
        type: "error",
        title: "Erro ao remover tarefa",
        message: error.message,
      });
      return false;
    }

    set((state) => ({ tasks: state.tasks.filter((task) => task.id !== taskId) }));
    return true;
  },
  moveTask: async (taskId, newStatus) => {
    const { data, error } = await supabase
      .from("tasks")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .select("*")
      .single();

    if (error) {
      get().addToast({
        type: "error",
        title: "Erro ao mover tarefa",
        message: error.message,
      });
      return false;
    }

    const movedTask = toTask(data as TaskRow);
    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === taskId ? movedTask : task)),
    }));
    return true;
  },

  // Filters
  filters: { department: "all", assignee: "all", priority: "all", status: "all" },
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),
  clearFilters: () =>
    set({
      filters: { department: "all", assignee: "all", priority: "all", status: "all" },
    }),

  // Search
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Sidebar
  sidebarExpanded: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),

  // Toasts
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { ...toast, id }],
    }));
    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  // Task Modal
  taskModalOpen: false,
  taskModalMode: "view",
  taskModalTaskId: null,
  taskModalDefaultStatus: null,
  openTaskModal: (mode, taskId = null, defaultStatus = null) =>
    set({
      taskModalOpen: true,
      taskModalMode: mode,
      taskModalTaskId: taskId,
      taskModalDefaultStatus: defaultStatus,
    }),
  closeTaskModal: () =>
    set({
      taskModalOpen: false,
      taskModalTaskId: null,
      taskModalDefaultStatus: null,
    }),

  // Notifications
  notifications: [
    { id: "n1", title: "Nova tarefa atribuida", message: "Voce foi atribuido a T-1247", read: false },
    { id: "n2", title: "Tarefa movida", message: "T-1230 foi movida para Em Revisao", read: false },
    { id: "n3", title: "Prazo proximo", message: "T-1242 vence amanha", read: true },
  ],
  unreadCount: 2,
  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(
        0,
        state.unreadCount -
          (state.notifications.find((n) => n.id === id && !n.read) ? 1 : 0)
      ),
    })),
}));
