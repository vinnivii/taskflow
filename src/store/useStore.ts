import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import type {
  User,
  Task,
  Comment,
  ActivityEntry,
  Notification,
  ToastMessage,
  TaskStatus,
  TaskPriority,
  Department,
} from "@/types";
import { supabase } from "@/utils/supabase";
import { generateAvatar } from "@/utils/avatar";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string | null | undefined) =>
  typeof value === "string" && UUID_REGEX.test(value);

type TaskRow = {
  id: string;
  display_id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  department: Department;
  assignee_id: string | null;
  creator_id: string;
  due_date: string | null;
  tags?: string[] | null;
  attachments_count?: number | null;
  created_at: string;
  updated_at: string;
};

type CommentRow = {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type ActivityRow = {
  id: string;
  task_id: string;
  user_id: string;
  action: ActivityEntry["action"];
  details: string;
  created_at: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  type: Notification["type"];
  task_id: string | null;
  created_at: string;
};

const toTask = (row: TaskRow): Task => ({
  id: row.id,
  displayId: row.display_id,
  title: row.title,
  description: row.description,
  priority: row.priority,
  status: row.status,
  department: row.department,
  assigneeId: row.assignee_id,
  creatorId: row.creator_id,
  dueDate: row.due_date ? new Date(row.due_date) : null,
  tags: row.tags ?? [],
  attachmentsCount: row.attachments_count ?? 0,
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
  attachments_count: task.attachmentsCount,
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
  if (updates.attachmentsCount !== undefined) payload.attachments_count = updates.attachmentsCount;
  payload.updated_at = new Date().toISOString();

  return payload;
};

interface AppState {
  // Auth
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  initAuth: () => Promise<void>;

  // Tasks
  tasks: Task[];
  fetchTasks: () => Promise<void>;
  addTask: (task: Task) => Promise<boolean>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<boolean>;
  deleteTask: (taskId: string) => Promise<boolean>;
  moveTask: (taskId: string, newStatus: TaskStatus) => Promise<boolean>;

  // Comments
  fetchComments: (taskId: string) => Promise<Comment[]>;
  addComment: (taskId: string, content: string) => Promise<boolean>;

  // Activity logs
  fetchActivityLog: (taskId: string) => Promise<ActivityEntry[]>;
  addActivityEntry: (
    taskId: string,
    entry: Omit<ActivityEntry, "id" | "createdAt">
  ) => Promise<boolean>;

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
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: (userId: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      set({
        currentUser: null,
        isAuthenticated: false,
        tasks: [],
        notifications: [],
        unreadCount: 0,
      });
    }
  });

  return ({
  // Auth
  currentUser: null,
  isAuthenticated: false,
  login: (user) => {
    set({ currentUser: user, isAuthenticated: true });
    void get().fetchNotifications(user.id);
  },
  logout: async () => {
    await supabase.auth.signOut();
    set({
      currentUser: null,
      isAuthenticated: false,
      tasks: [],
      notifications: [],
      unreadCount: 0,
      filters: { department: "all", assignee: "all", priority: "all", status: "all" },
      searchQuery: "",
    });
  },
  initAuth: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (error || !data) return;

    const user: User = {
      id: data.id,
      name: data.name,
      email: data.email,
      avatar: generateAvatar(data.name),
      role: data.role,
      department: data.department,
      createdAt: new Date(data.created_at),
    };

    set({ currentUser: user, isAuthenticated: true });
    void get().fetchNotifications(user.id);
  },

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
        message: error.message,
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
        message: error.message,
      });
      return false;
    }

    const updatedTask = toTask(data as TaskRow);
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? { ...updatedTask, comments: task.comments, activityLog: task.activityLog }
          : task
      ),
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
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? { ...movedTask, comments: task.comments, activityLog: task.activityLog }
          : task
      ),
    }));
    return true;
  },

  // Comments
  fetchComments: async (taskId) => {
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (error) return [];

    const comments: Comment[] = (data as CommentRow[]).map((row) => ({
      id: row.id,
      taskId: row.task_id,
      userId: row.user_id,
      content: row.content,
      createdAt: new Date(row.created_at),
    }));

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, comments } : t
      ),
    }));

    return comments;
  },
  addComment: async (taskId, content) => {
    const currentUser = get().currentUser;
    if (!currentUser) return false;

    const { data, error } = await supabase
      .from("comments")
      .insert({ task_id: taskId, user_id: currentUser.id, content })
      .select("*")
      .single();

    if (error) {
      get().addToast({
        type: "error",
        title: "Erro ao adicionar comentario",
        message: error.message,
      });
      return false;
    }

    const newComment: Comment = {
      id: (data as CommentRow).id,
      taskId: (data as CommentRow).task_id,
      userId: (data as CommentRow).user_id,
      content: (data as CommentRow).content,
      createdAt: new Date((data as CommentRow).created_at),
    };

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, comments: [...(t.comments ?? []), newComment] }
          : t
      ),
    }));

    return true;
  },

  // Activity logs
  fetchActivityLog: async (taskId) => {
    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (error) return [];

    const activityLog: ActivityEntry[] = (data as ActivityRow[]).map((row) => ({
      id: row.id,
      taskId: row.task_id,
      userId: row.user_id,
      action: row.action,
      details: row.details,
      createdAt: new Date(row.created_at),
    }));

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, activityLog } : t
      ),
    }));

    return activityLog;
  },
  addActivityEntry: async (taskId, entry) => {
    const { data, error } = await supabase
      .from("activity_logs")
      .insert({
        task_id: taskId,
        user_id: entry.userId,
        action: entry.action,
        details: entry.details,
      })
      .select("*")
      .single();

    if (error) {
      get().addToast({
        type: "error",
        title: "Erro ao registrar atividade",
        message: error.message,
      });
      return false;
    }

    const newEntry: ActivityEntry = {
      id: (data as ActivityRow).id,
      taskId: (data as ActivityRow).task_id,
      userId: (data as ActivityRow).user_id,
      action: (data as ActivityRow).action,
      details: (data as ActivityRow).details,
      createdAt: new Date((data as ActivityRow).created_at),
    };

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, activityLog: [...(t.activityLog ?? []), newEntry] }
          : t
      ),
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
  notifications: [],
  unreadCount: 0,
  fetchNotifications: async (userId) => {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return;

    const notifications: Notification[] = (data as NotificationRow[]).map((row) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      message: row.message,
      read: row.is_read,
      type: row.type,
      taskId: row.task_id,
      createdAt: new Date(row.created_at),
    }));

    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    });
  },
  markNotificationRead: async (id) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) return;

    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(
        0,
        state.unreadCount -
          (state.notifications.find((n) => n.id === id && !n.read) ? 1 : 0)
      ),
    }));
  },
}); });
