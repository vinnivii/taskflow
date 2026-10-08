import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  User,
  Task,
  Kanban,
  KanbanColumn,
  KanbanColumnKind,
  Comment,
  ActivityEntry,
  Notification,
  ToastMessage,
  TaskPriority,
  Department,
  Customer,
} from "@/types";
import { supabase } from "@/utils/supabase";
import { invokeAdmin } from "@/lib/admin-api";
import { generateAvatar } from "@/utils/avatar";
import { getKanbanPermissions, isTaskCompleted, sortColumns } from "@/lib/kanban";

type KanbanRow = {
  id: string; slug: string; name: string; color: string; position: number;
  created_by: string | null; created_at: string; tasks?: { count: number }[];
};
type ColumnRow = {
  id: string; kanban_id: string; key: string; name: string; color: string;
  kind: KanbanColumnKind; position: number; created_at: string;
};
const toKanban = (row: KanbanRow): Kanban => ({
  id: row.id, slug: row.slug, name: row.name, color: row.color, position: row.position,
  createdBy: row.created_by, createdAt: new Date(row.created_at), taskCount: row.tasks?.[0]?.count ?? 0,
});
const toColumn = (row: ColumnRow): KanbanColumn => ({
  id: row.id, kanbanId: row.kanban_id, key: row.key, name: row.name, color: row.color,
  kind: row.kind, position: row.position, createdAt: new Date(row.created_at),
});

async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: Notification["type"],
  taskId: string
) {
  await supabase.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type,
    task_id: taskId,
    is_read: false,
  });
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string | null | undefined) =>
  typeof value === "string" && UUID_REGEX.test(value);

type TaskRow = {
  id: string;
  display_id: string;
  id_task: number;
  id_rfc: number | null;
  title: string;
  description: string;
  priority: TaskPriority;
  kanban_id: string;
  column_id: string;
  department: Department;
  assignee_id: string | null;
  customer_id: string | null;
  creator_id: string;
  due_date: string | null;
  tags?: string[] | null;
  attachments_count?: number | null;
  archived?: boolean | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
};

type CommentRow = {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  image_url: string | null;
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
  idTask: row.id_task ?? 0,
  idRfc: row.id_rfc ?? null,
  title: row.title,
  description: row.description,
  priority: row.priority,
  kanbanId: row.kanban_id,
  columnId: row.column_id,
  department: row.department,
  assigneeId: row.assignee_id,
  customerId: row.customer_id ?? null,
  creatorId: row.creator_id,
  dueDate: row.due_date ? new Date(row.due_date) : null,
  tags: row.tags ?? [],
  attachmentsCount: row.attachments_count ?? 0,
  archived: row.archived ?? false,
  archivedAt: row.archived_at ? new Date(row.archived_at) : null,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

const toTaskInsert = (task: Task) => ({
  id: task.id,
  title: task.title,
  description: task.description,
  priority: task.priority,
  kanban_id: task.kanbanId,
  column_id: task.columnId,
  id_rfc: task.idRfc,
  department: task.department,
  assignee_id: isUuid(task.assigneeId) ? task.assigneeId : null,
  customer_id: isUuid(task.customerId) ? task.customerId : null,
  creator_id: task.creatorId,
  due_date: task.dueDate ? task.dueDate.toISOString() : null,
  tags: task.tags,
  attachments_count: task.attachmentsCount,
  archived: task.archived ?? false,
  archived_at: task.archivedAt ? task.archivedAt.toISOString() : null,
  created_at: task.createdAt.toISOString(),
  updated_at: task.updatedAt.toISOString(),
});

const toTaskUpdate = (updates: Partial<Task>) => {
  const payload: Record<string, unknown> = {};

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.columnId !== undefined) payload.column_id = updates.columnId;
  if (updates.department !== undefined) payload.department = updates.department;
  if (updates.assigneeId !== undefined) {
    payload.assignee_id = isUuid(updates.assigneeId) ? updates.assigneeId : null;
  }
  if (updates.customerId !== undefined) {
    payload.customer_id = isUuid(updates.customerId) ? updates.customerId : null;
  }
  if (updates.creatorId !== undefined) payload.creator_id = updates.creatorId;
  if (updates.dueDate !== undefined) {
    payload.due_date = updates.dueDate ? updates.dueDate.toISOString() : null;
  }
  if (updates.idRfc !== undefined) payload.id_rfc = updates.idRfc;
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (updates.attachmentsCount !== undefined) payload.attachments_count = updates.attachmentsCount;
  if (updates.archived !== undefined) payload.archived = updates.archived;
  if (updates.archivedAt !== undefined) {
    payload.archived_at = updates.archivedAt ? updates.archivedAt.toISOString() : null;
  }
  payload.updated_at = new Date().toISOString();

  return payload;
};

interface AppState {
  // Auth
  currentUser: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  initAuth: () => Promise<void>;

  // Realtime
  _realtimeChannel: RealtimeChannel | null;
  _taskChannel: RealtimeChannel | null;
  _notificationsChannel: RealtimeChannel | null;
  subscribeRealtime: () => void;
  subscribeTaskRealtime: (kanbanId: string) => void;
  unsubscribeRealtime: () => void;

  // Users
  users: User[];
  fetchUsers: () => Promise<void>;
  createMember: (data: {
    name: string;
    email: string;
    password: string;
    role: User["role"];
    department: User["department"];
  }) => Promise<{ success: boolean; error?: string }>;
  resetMemberPassword: (memberId: string, password: string) => Promise<{ success: boolean; error?: string }>;

  // The active ID is a cache of the route, not a second navigation source.
  kanbans: Kanban[];
  kanbansLoaded: boolean;
  kanbansError: string | null;
  activeKanbanId: string | null;
  scopeLoading: boolean;
  scopeError: string | null;
  setActiveKanban: (id: string | null) => Promise<void>;
  fetchKanbans: () => Promise<boolean>;
  createKanban: (data: { name: string; slug: string; color: string }) => Promise<Kanban | null>;
  updateKanban: (id: string, data: Partial<Pick<Kanban, "name" | "slug" | "color">>) => Promise<boolean>;
  transferAndDeleteKanban: (sourceId: string, destinationId: string | null, mapping: Record<string, string>, password: string) => Promise<{ success: boolean; transferred?: number; error?: string }>;
  reorderKanbans: (ids: string[]) => Promise<boolean>;
  columns: KanbanColumn[];
  fetchColumns: (kanbanId: string) => Promise<boolean>;
  createColumn: (data: { key: string; name: string; color: string; kind: KanbanColumnKind }) => Promise<boolean>;
  updateColumn: (id: string, data: Partial<Pick<KanbanColumn, "name" | "color" | "kind">>) => Promise<boolean>;
  deleteColumnWithTasks: (id: string, mode: "transfer" | "delete", destinationId?: string) => Promise<boolean>;
  reorderColumns: (ids: string[]) => Promise<boolean>;

  // Tasks
  tasks: Task[];
  fetchTasks: (kanbanId?: string) => Promise<boolean>;
  addTask: (task: Task) => Promise<boolean>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<boolean>;
  deleteTask: (taskId: string) => Promise<boolean>;
  moveTask: (taskId: string, columnId: string) => Promise<boolean>;
  archiveTask: (taskId: string) => Promise<boolean>;
  unarchiveTask: (taskId: string) => Promise<boolean>;

  // Comments
  fetchComments: (taskId: string) => Promise<Comment[]>;
  addComment: (taskId: string, content: string, imageUrl?: string | null) => Promise<boolean>;

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
    columnId: "all" | string;
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
  mobileSidebarOpen: boolean;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;

  // Theme
  theme: "dark" | "light";
  toggleTheme: () => void;

  // Toasts
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;

  // Task Modal
  taskModalOpen: boolean;
  taskModalMode: "create" | "view" | "edit";
  taskModalTaskId: string | null;
  taskModalDefaultColumnId: string | null;
  openTaskModal: (
    mode: "create" | "view" | "edit",
    taskId?: string | null,
    defaultColumnId?: string | null
  ) => void;
  closeTaskModal: () => void;

  // Customers
  customers: Customer[];
  fetchCustomers: () => Promise<void>;
  createCustomer: (data: { cod: string; documento: string; nome: string }) => Promise<{ success: boolean; error?: string }>;
  updateCustomer: (id: string, data: Partial<Pick<Customer, "cod" | "documento" | "nome">>) => Promise<boolean>;
  deleteCustomer: (id: string) => Promise<boolean>;

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: (userId: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const deletingTasks = new Set<string>();

export const useStore = create<AppState>((set, get) => {
  let scopeVersion = 0;
  let taskRequest = 0;
  let columnRequest = 0;
  let kanbanRequest = 0;
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      get().unsubscribeRealtime();
      set({
        currentUser: null,
        isAuthenticated: false,
        tasks: [], kanbans: [], columns: [], activeKanbanId: null,
        kanbansLoaded: false, kanbansError: null, scopeLoading: false, scopeError: null, taskModalOpen: false,
        users: [],
        notifications: [],
        unreadCount: 0,
      });
    }
  });

  return ({
  // Auth
  currentUser: null,
  isAuthenticated: false,
  authLoading: true,
  login: (user) => {
    set({ currentUser: user, isAuthenticated: true });
    void get().fetchUsers();
    void get().fetchKanbans();
    void get().fetchCustomers();
    void get().fetchNotifications(user.id);
    get().subscribeRealtime();
  },
  logout: async () => {
    get().unsubscribeRealtime();
    await supabase.auth.signOut();
    set({
      currentUser: null,
      isAuthenticated: false,
      tasks: [], kanbans: [], columns: [], activeKanbanId: null,
      kanbansLoaded: false, kanbansError: null, scopeLoading: false, scopeError: null, taskModalOpen: false,
      users: [],
      notifications: [],
      unreadCount: 0,
      filters: { department: "all", assignee: "all", priority: "all", columnId: "all" },
      searchQuery: "",
    });
  },
  initAuth: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      set({ authLoading: false });
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      set({ authLoading: false });
      return;
    }

    const user: User = {
      id: data.id,
      name: data.name,
      email: data.email,
      avatar: (data as { avatar?: string }).avatar || generateAvatar(data.name),
      role: data.role,
      department: data.department,
      createdAt: new Date(data.created_at),
    };

    set({ currentUser: user, isAuthenticated: true, authLoading: false });
    void get().fetchUsers();
    void get().fetchKanbans();
    void get().fetchCustomers();
    void get().fetchNotifications(user.id);
    get().subscribeRealtime();
  },

  // Realtime: metadata is shared; task and column payloads are scoped to the route.
  _realtimeChannel: null,
  _taskChannel: null,
  _notificationsChannel: null,
  subscribeRealtime: () => {
    if (get()._realtimeChannel) return;
    const userId = get().currentUser?.id;
    if (!userId) return;
    const metadata = supabase.channel(`kanban-metadata-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kanbans" }, () => {
        if (get().currentUser?.id === userId) void get().fetchKanbans();
      }).subscribe();
    const notifications = supabase.channel(`notifications-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        if (get().currentUser?.id !== userId) return;
        const row = payload.new as NotificationRow;
        const notification: Notification = {
          id: row.id, userId: row.user_id, title: row.title, message: row.message,
          read: row.is_read, type: row.type, taskId: row.task_id, createdAt: new Date(row.created_at),
        };
        set((state) => state.notifications.some((entry) => entry.id === row.id) ? state : ({
          notifications: [notification, ...state.notifications], unreadCount: state.unreadCount + (row.is_read ? 0 : 1),
        }));
      }).subscribe();
    set({ _realtimeChannel: metadata, _notificationsChannel: notifications });
  },
  subscribeTaskRealtime: (kanbanId) => {
    const previous = get()._taskChannel;
    if (previous) void supabase.removeChannel(previous);
    const version = scopeVersion;
    const isCurrent = () => scopeVersion === version && get().activeKanbanId === kanbanId && get().isAuthenticated;
    const refreshTask = () => { if (isCurrent()) { void get().fetchTasks(kanbanId); void get().fetchKanbans(); } };
    const channel = supabase.channel(`kanban-${kanbanId}-${version}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks", filter: `kanban_id=eq.${kanbanId}` }, refreshTask)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks", filter: `kanban_id=eq.${kanbanId}` }, refreshTask)
      // PostgreSQL DELETE events cannot be filtered. Only remove an ID already in this scope.
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tasks" }, (payload) => {
        if (!isCurrent()) return;
        const id = (payload.old as { id: string }).id;
        if (get().tasks.some((task) => task.id === id)) refreshTask();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_columns", filter: `kanban_id=eq.${kanbanId}` }, () => {
        if (isCurrent()) void get().fetchColumns(kanbanId);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "kanban_columns" }, (payload) => {
        if (isCurrent() && get().columns.some((column) => column.id === (payload.old as { id: string }).id)) void get().fetchColumns(kanbanId);
      })
      .subscribe((status) => { if (status === "SUBSCRIBED" && isCurrent() && !get().scopeLoading) { refreshTask(); void get().fetchColumns(kanbanId); } });
    set({ _taskChannel: channel });
  },
  unsubscribeRealtime: () => {
    scopeVersion++; taskRequest++; columnRequest++; kanbanRequest++;
    for (const channel of [get()._realtimeChannel, get()._taskChannel, get()._notificationsChannel]) {
      if (channel) void supabase.removeChannel(channel);
    }
    set({ _realtimeChannel: null, _taskChannel: null, _notificationsChannel: null });
  },

  kanbans: [],
  kanbansLoaded: false,
  kanbansError: null,
  activeKanbanId: null,
  scopeLoading: false,
  scopeError: null,
  columns: [],
  setActiveKanban: async (id) => {
    if (id === get().activeKanbanId && !get().scopeError) return;
    if (id && !get().kanbans.some((kanban) => kanban.id === id)) return;
    const version = ++scopeVersion;
    taskRequest++; columnRequest++;
    const previous = get()._taskChannel;
    if (previous) void supabase.removeChannel(previous);
    set({ activeKanbanId: id, columns: [], tasks: [], scopeLoading: !!id, scopeError: null,
      _taskChannel: null, filters: { department: "all", assignee: "all", priority: "all", columnId: "all" },
      searchQuery: "", taskModalOpen: false, taskModalTaskId: null, taskModalDefaultColumnId: null });
    if (!id) return;
    const userId = get().currentUser?.id;
    if (userId) localStorage.setItem(`tf_kanban_${userId}`, id);
    get().subscribeTaskRealtime(id);
    const [columnsLoaded, tasksLoaded] = await Promise.all([get().fetchColumns(id), get().fetchTasks(id)]);
    if (scopeVersion === version) set({ scopeLoading: false,
      scopeError: columnsLoaded && tasksLoaded ? null : get().scopeError ?? "Não foi possível carregar este Kanban." });
  },
  fetchKanbans: async () => {
    const request = ++kanbanRequest;
    const userId = get().currentUser?.id;
    const { data, error } = await supabase.from("kanbans").select("*,tasks(count)")
      .order("position", { ascending: true }).order("id", { ascending: true });
    if (request !== kanbanRequest || get().currentUser?.id !== userId) return false;
    if (error || !data) {
      set({ kanbansLoaded: true, kanbansError: error?.message ?? "Erro ao carregar Kanbans" });
      return false;
    }
    set({ kanbans: (data as KanbanRow[]).map(toKanban), kanbansLoaded: true, kanbansError: null });
    return true;
  },
  createKanban: async ({ name, slug, color }) => {
    if (!getKanbanPermissions(get().currentUser, get().columns).canManageKanbans) return null;
    const { data, error } = await supabase.rpc("create_kanban", { p_name: name, p_slug: slug, p_color: color });
    if (error || !data) {
      get().addToast({ type: "error", title: "Erro ao criar Kanban", message: error?.message ?? "Tente novamente." });
      return null;
    }
    const kanban = toKanban((Array.isArray(data) ? data[0] : data) as KanbanRow);
    await get().fetchKanbans();
    return kanban;
  },
  updateKanban: async (id, data) => {
    if (!getKanbanPermissions(get().currentUser, get().columns).canManageKanbans) return false;
    const { data: rows, error } = await supabase.from("kanbans").update(data).eq("id", id).select("id");
    if (error || !rows?.length) {
      get().addToast({ type: "error", title: "Erro ao atualizar Kanban", message: error?.message ?? "Sem permissão ou Kanban removido." });
      return false;
    }
    await get().fetchKanbans();
    return true;
  },
  transferAndDeleteKanban: async (sourceId, destinationId, mapping, password) => {
    if (!getKanbanPermissions(get().currentUser, get().columns).canManageKanbans) return { success: false, error: "Sem permiss\u00e3o." };
    const { data, error } = await invokeAdmin<{ success: boolean; transferred: number }>("delete-kanban", { sourceId, destinationId, mapping, password });
    if (error || !data?.success) return { success: false, error: error ?? "Exclus\u00e3o n\u00e3o confirmada." };
    if (get().activeKanbanId === sourceId) await get().setActiveKanban(null);
    await get().fetchKanbans();
    if (destinationId && get().kanbans.some((entry) => entry.id === destinationId)) await get().setActiveKanban(destinationId);
    else if (get().activeKanbanId) await Promise.all([get().fetchColumns(get().activeKanbanId!), get().fetchTasks()]);
    return { success: true, transferred: data.transferred };
  },
  reorderKanbans: async (ids) => {
    if (!getKanbanPermissions(get().currentUser, get().columns).canManageKanbans) return false;
    const { error } = await supabase.rpc("reorder_kanbans", { p_ids: ids });
    if (error) { get().addToast({ type: "error", title: "Erro ao ordenar Kanbans", message: error.message }); return false; }
    await get().fetchKanbans();
    return true;
  },
  fetchColumns: async (kanbanId) => {
    if (get().activeKanbanId !== kanbanId) return false;
    const request = ++columnRequest;
    const { data, error } = await supabase.from("kanban_columns").select("*").eq("kanban_id", kanbanId)
      .order("position", { ascending: true }).order("id", { ascending: true });
    if (request !== columnRequest || get().activeKanbanId !== kanbanId) return true;
    if (error || !data) { set({ scopeError: error?.message ?? "Erro ao carregar colunas" }); return false; }
    const columns = sortColumns((data as ColumnRow[]).map(toColumn));
    set((state) => ({ columns, filters: { ...state.filters,
      columnId: state.filters.columnId === "all" || columns.some((column) => column.id === state.filters.columnId) ? state.filters.columnId : "all" } }));
    return true;
  },
  createColumn: async ({ key, name, color, kind }) => {
    const { activeKanbanId, columns, currentUser } = get();
    if (!activeKanbanId || !getKanbanPermissions(currentUser, columns).canManageKanbans) return false;
    const position = columns.length ? Math.max(...columns.map((column) => column.position)) + 1 : 0;
    const { error } = await supabase.from("kanban_columns").insert({ kanban_id: activeKanbanId, key, name, color, kind, position });
    if (error) { get().addToast({ type: "error", title: "Erro ao criar coluna", message: error.message }); return false; }
    await get().fetchColumns(activeKanbanId);
    return true;
  },
  updateColumn: async (id, updates) => {
    const { activeKanbanId, columns, currentUser } = get();
    if (!activeKanbanId || !columns.some((column) => column.id === id) || !getKanbanPermissions(currentUser, columns).canManageKanbans) return false;
    const { data, error } = await supabase.from("kanban_columns").update(updates).eq("id", id).eq("kanban_id", activeKanbanId).select("id");
    if (error || !data?.length) { get().addToast({ type: "error", title: "Erro ao atualizar coluna", message: error?.message ?? "Coluna removida ou sem permissão." }); return false; }
    await get().fetchColumns(activeKanbanId);
    return true;
  },
  deleteColumnWithTasks: async (id, mode, destinationId) => {
    const { activeKanbanId, columns, currentUser } = get();
    if (!activeKanbanId || !columns.some((column) => column.id === id) || !getKanbanPermissions(currentUser, columns).canManageKanbans) return false;
    const { data, error } = await supabase.rpc("delete_column_with_tasks", { p_column_id: id, p_kanban_id: activeKanbanId, p_mode: mode, p_destination_id: destinationId ?? null });
    if (error || !data) { get().addToast({ type: "error", title: "Erro ao excluir coluna", message: error?.message ?? "Exclus\u00e3o n\u00e3o confirmada." }); return false; }
    await Promise.all([get().fetchColumns(activeKanbanId), get().fetchTasks(activeKanbanId), get().fetchKanbans()]);
    if (mode === "delete") void invokeAdmin("cleanup-task-storage", {});
    return true;
  },
  reorderColumns: async (ids) => {
    const { activeKanbanId, columns, currentUser } = get();
    if (!activeKanbanId || !getKanbanPermissions(currentUser, columns).canManageKanbans) return false;
    const { error } = await supabase.rpc("reorder_kanban_columns", { p_kanban_id: activeKanbanId, p_ids: ids });
    if (error) { get().addToast({ type: "error", title: "Erro ao ordenar colunas", message: error.message }); return false; }
    await get().fetchColumns(activeKanbanId);
    return true;
  },

  // Users
  users: [],
  fetchUsers: async () => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("name", { ascending: true });

    if (error) return;

    const users: User[] = (data as Array<{ id: string; name: string; email: string; avatar: string; role: User["role"]; department: User["department"]; created_at: string }>).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      avatar: row.avatar || generateAvatar(row.name),
      role: row.role,
      department: row.department,
      createdAt: new Date(row.created_at),
    }));

    set({ users });
  },
  createMember: async (member) => {
    if (get().currentUser?.role !== "supervisor_geral") return { success: false, error: "Sem permiss\u00e3o." };
    const { data, error } = await invokeAdmin<{ success: boolean }>("create-member", member);
    if (error || !data?.success) return { success: false, error: error ?? "Cadastro n\u00e3o confirmado." };
    await get().fetchUsers();
    return { success: true };
  },
  resetMemberPassword: async (memberId, password) => {
    if (get().currentUser?.role !== "supervisor_geral") return { success: false, error: "Sem permiss\u00e3o." };
    const { data, error } = await invokeAdmin<{ success: boolean }>("reset-member-password", { memberId, password });
    return error || !data?.success ? { success: false, error: error ?? "Altera\u00e7\u00e3o n\u00e3o confirmada." } : { success: true };
  },

  // Tasks
  tasks: [],
  fetchTasks: async (kanbanId = get().activeKanbanId ?? undefined) => {
    if (!kanbanId || get().activeKanbanId !== kanbanId) return false;
    const request = ++taskRequest;
    const rows: TaskRow[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from("tasks").select("*").eq("kanban_id", kanbanId)
        .order("created_at", { ascending: false }).order("id", { ascending: true }).range(offset, offset + pageSize - 1);
      if (request !== taskRequest || get().activeKanbanId !== kanbanId) return true;
      if (error || !data) { set({ scopeError: error?.message ?? "Erro ao carregar tarefas" }); return false; }
      rows.push(...data as TaskRow[]);
      if (data.length < pageSize) break;
    }
    set((state) => ({ tasks: rows.map((row) => {
      const previous = state.tasks.find((task) => task.id === row.id);
      return { ...toTask(row), comments: previous?.comments, activityLog: previous?.activityLog };
    }) }));
    return true;
  },
  addTask: async (task) => {
    const { activeKanbanId, columns, currentUser } = get();
    if (!currentUser || task.creatorId !== currentUser.id || task.kanbanId !== activeKanbanId ||
      !columns.some((column) => column.id === task.columnId && column.kanbanId === task.kanbanId) ||
      !getKanbanPermissions(currentUser, columns).canCreateInColumn(task.columnId)) return false;
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

    const newTask = toTask(data as TaskRow);
    set((state) => state.activeKanbanId !== newTask.kanbanId ? state : ({
      tasks: [newTask, ...state.tasks.filter((entry) => entry.id !== newTask.id)],
    }));
    void get().fetchKanbans();

    const currentUserId = get().currentUser?.id;
    if (newTask.assigneeId && newTask.assigneeId !== currentUserId) {
      void createNotification(
        newTask.assigneeId,
        "Nova tarefa atribuída",
        `Você foi atribuído à tarefa "${newTask.title}"`,
        "task_assigned",
        newTask.id
      );
    }

    return true;
  },
  updateTask: async (taskId, updates) => {
    const currentUserId = get().currentUser?.id;
    const prev = get().tasks.find((t) => t.id === taskId);
    const permissions = getKanbanPermissions(get().currentUser, get().columns);
    const target = updates.columnId ? get().columns.find((column) => column.id === updates.columnId) : null;
    if (!prev || prev.kanbanId !== get().activeKanbanId || !permissions.canEditTask(prev.creatorId, prev.assigneeId) ||
      (updates.kanbanId !== undefined && updates.kanbanId !== prev.kanbanId) ||
      (updates.columnId !== undefined && (!target || target.kanbanId !== prev.kanbanId ||
        !permissions.canMoveToColumn(prev.columnId, updates.columnId)))) return false;

    const { data, error } = await supabase
      .from("tasks")
      .update(toTaskUpdate(updates))
      .eq("id", taskId)
      .eq("kanban_id", prev.kanbanId)
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

    if (target && currentUserId && target.id !== prev.columnId) {
      await get().addActivityEntry(taskId, { taskId, userId: currentUserId, action: "status_changed", details: `moveu a tarefa para ${target.name}` });
    }

    if (prev) {
      if (
        updates.assigneeId !== undefined &&
        updates.assigneeId !== prev.assigneeId &&
        updates.assigneeId &&
        updates.assigneeId !== currentUserId
      ) {
        void createNotification(
          updates.assigneeId,
          "Nova tarefa atribuída",
          `Você foi atribuído à tarefa "${prev.title}"`,
          "task_assigned",
          taskId
        );
      }
      if (
        updates.columnId !== undefined &&
        updates.columnId !== prev.columnId &&
        prev.assigneeId &&
        prev.assigneeId !== currentUserId
      ) {
        void createNotification(
          prev.assigneeId,
          "Status atualizado",
          `"${prev.title}" foi movida para ${get().columns.find(column => column.id === updates.columnId)?.name ?? "coluna removida"}`,
          "status_changed",
          taskId
        );
      }
    }

    return true;
  },
  deleteTask: async (taskId) => {
    const task = get().tasks.find((entry) => entry.id === taskId);
    if (!task || task.kanbanId !== get().activeKanbanId || !getKanbanPermissions(get().currentUser, get().columns).canDeleteTask || deletingTasks.has(taskId)) return false;
    deletingTasks.add(taskId);
    try {
      const { data, error } = await supabase.rpc("delete_task_with_cleanup", { p_task_id: taskId, p_kanban_id: task.kanbanId });
      if (error || data !== taskId) {
        get().addToast({ type: "error", title: "Erro ao remover tarefa", message: error?.message ?? "A exclus\u00e3o da tarefa n\u00e3o foi confirmada." });
        return false;
      }
      set((state) => ({ tasks: state.tasks.filter((entry) => entry.id !== taskId) }));
      if (get().taskModalTaskId === taskId) get().closeTaskModal();
      void get().fetchKanbans();
      void invokeAdmin("cleanup-task-storage", {});
      return true;
    } finally { deletingTasks.delete(taskId); }
  },
  moveTask: async (taskId, columnId) => {
    const { currentUser, tasks, columns, activeKanbanId } = get();
    const previous = tasks.find((task) => task.id === taskId);
    const target = columns.find((column) => column.id === columnId && column.kanbanId === activeKanbanId);
    if (!previous || !target || previous.kanbanId !== activeKanbanId || !currentUser ||
      !getKanbanPermissions(currentUser, columns).canMoveToColumn(previous.columnId, columnId)) return false;
    const { data, error } = await supabase.from("tasks")
      .update({ column_id: columnId, updated_at: new Date().toISOString() }).eq("id", taskId)
      .eq("kanban_id", previous.kanbanId).select("*").single();
    if (error) { get().addToast({ type: "error", title: "Erro ao mover tarefa", message: error.message }); return false; }
    const movedTask = toTask(data as TaskRow);
    set((state) => ({ tasks: state.tasks.map((task) => task.id === taskId
      ? { ...movedTask, comments: task.comments, activityLog: task.activityLog } : task) }));
    if (previous.columnId !== columnId) {
      await get().addActivityEntry(taskId, { taskId, userId: currentUser.id, action: "status_changed", details: `moveu a tarefa para ${target.name}` });
      if (previous.assigneeId && previous.assigneeId !== currentUser.id) {
        void createNotification(previous.assigneeId, "Status atualizado", `"${previous.title}" foi movida para ${target.name}`, "status_changed", taskId);
      }
    }
    return true;
  },

  archiveTask: async (taskId) => {
    const task = get().tasks.find((entry) => entry.id === taskId);
    if (!task || !getKanbanPermissions(get().currentUser, get().columns).canArchiveTask() ||
      !isTaskCompleted(task, get().columns)) return false;
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("tasks")
      .update({ archived: true, archived_at: now, updated_at: now })
      .eq("id", taskId)
      .eq("kanban_id", task.kanbanId)
      .select("*")
      .single();

    if (error) {
      get().addToast({
        type: "error",
        title: "Erro ao arquivar tarefa",
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

  unarchiveTask: async (taskId) => {
    const task = get().tasks.find((entry) => entry.id === taskId);
    if (!task ||
      !getKanbanPermissions(get().currentUser, get().columns).canArchiveTask()) return false;
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("tasks")
      .update({ archived: false, archived_at: null, updated_at: now })
      .eq("id", taskId)
      .eq("kanban_id", task.kanbanId)
      .select("*")
      .single();

    if (error) {
      get().addToast({
        type: "error",
        title: "Erro ao desarquivar tarefa",
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
      imageUrl: row.image_url,
      createdAt: new Date(row.created_at),
    }));

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, comments } : t
      ),
    }));

    return comments;
  },
  addComment: async (taskId, content, imageUrl) => {
    const currentUser = get().currentUser;
    if (!currentUser) return false;

    const { data, error } = await supabase
      .from("comments")
      .insert({ task_id: taskId, user_id: currentUser.id, content, image_url: imageUrl ?? null })
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
      imageUrl: (data as CommentRow).image_url,
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
  filters: { department: "all", assignee: "all", priority: "all", columnId: "all" },
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),
  clearFilters: () =>
    set({
      filters: { department: "all", assignee: "all", priority: "all", columnId: "all" },
    }),

  // Search
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Sidebar
  sidebarExpanded: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),
  mobileSidebarOpen: false,
  toggleMobileSidebar: () =>
    set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),

  theme: (localStorage.getItem("tf_theme") as "dark" | "light") || "dark",
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("tf_theme", next);
      return { theme: next };
    }),

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
  taskModalDefaultColumnId: null,
  openTaskModal: (mode, taskId = null, defaultColumnId = null) => {
    const { activeKanbanId, columns, tasks, currentUser } = get();
    if (!activeKanbanId) return;
    if (mode !== "create" && !tasks.some((task) => task.id === taskId && task.kanbanId === activeKanbanId)) return;
    if (mode === "create" && !getKanbanPermissions(currentUser, columns).canCreateTask()) return;
    const initialColumn = columns.find((column) => column.id === defaultColumnId && column.kanbanId === activeKanbanId) ?? columns[0];
    if (!initialColumn) return;
    set({ taskModalOpen: true, taskModalMode: mode, taskModalTaskId: taskId, taskModalDefaultColumnId: initialColumn.id });
  },
  closeTaskModal: () =>
    set({
      taskModalOpen: false,
      taskModalTaskId: null,
      taskModalDefaultColumnId: null,
    }),

  // Customers
  customers: [],
  fetchCustomers: async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("nome", { ascending: true });
    if (error || !data) return;
    const customers: Customer[] = (data as Array<{ id: string; cod: string; documento: string; nome: string; created_at: string; updated_at: string }>).map((row) => ({
      id: row.id,
      cod: row.cod,
      documento: row.documento,
      nome: row.nome,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
    set({ customers });
  },
  createCustomer: async ({ cod, documento, nome }) => {
    const { data, error } = await supabase
      .from("customers")
      .insert({ cod, documento, nome })
      .select("*")
      .single();
    if (error || !data) return { success: false, error: error?.message ?? "Erro ao criar cliente" };
    const row = data as { id: string; cod: string; documento: string; nome: string; created_at: string; updated_at: string };
    const newCustomer: Customer = { id: row.id, cod: row.cod, documento: row.documento, nome: row.nome, createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at) };
    set((state) => ({ customers: [...state.customers, newCustomer].sort((a, b) => a.nome.localeCompare(b.nome)) }));
    return { success: true };
  },
  updateCustomer: async (id, data) => {
    const { error } = await supabase.from("customers").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return false;
    set((state) => ({
      customers: state.customers.map((c) => c.id === id ? { ...c, ...data, updatedAt: new Date() } : c),
    }));
    return true;
  },
  deleteCustomer: async (id) => {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return false;
    set((state) => ({ customers: state.customers.filter((c) => c.id !== id) }));
    return true;
  },

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
  markAllNotificationsRead: async () => {
    const userId = get().currentUser?.id;
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
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
