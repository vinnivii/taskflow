import { create } from "zustand";
import type {
  User,
  UserRole,
  Task,
  ToastMessage,
  TaskStatus,
  TaskPriority,
  Department,
} from "@/types";
import { mockUsers, mockTasks } from "@/data/mockData";

interface AppState {
  // Auth
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;

  // Tasks
  tasks: Task[];
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  moveTask: (taskId: string, newStatus: TaskStatus) => void;

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
      tasks: mockTasks,
      filters: { department: "all", assignee: "all", priority: "all", status: "all" },
      searchQuery: "",
    }),

  // Tasks
  tasks: [...mockTasks],
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates, updatedAt: new Date() } : t
      ),
    })),
  deleteTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    })),
  moveTask: (taskId, newStatus) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: newStatus, updatedAt: new Date() }
          : t
      ),
    })),

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
