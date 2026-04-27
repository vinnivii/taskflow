export type UserRole =
  | "supervisor_geral"
  | "supervisor_adjunto"
  | "tecnico"
  | "estagiario"
  | "comercial"
  | "financeiro";

export type Department = "comercial" | "financeiro" | "suporte";

export type TaskPriority = "urgent" | "high" | "medium" | "low";

export type TaskStatus =
  | "novo"
  | "em_andamento"
  | "em_revisao"
  | "concluido"
  | "bloqueado";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  department: Department;
  createdAt: Date;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: Date;
}

export interface ActivityEntry {
  id: string;
  taskId: string;
  userId: string;
  action:
    | "created"
    | "status_changed"
    | "assigned"
    | "commented"
    | "priority_changed"
    | "edited";
  details: string;
  createdAt: Date;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  department: Department;
  assigneeId: string | null;
  creatorId: string;
  dueDate: Date | null;
  tags: string[];
  comments: Comment[];
  attachments: number;
  activityLog: ActivityEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  type: "task_assigned" | "status_changed" | "mention" | "deadline";
  taskId: string | null;
  createdAt: Date;
}

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
}

export const roleDisplayNames: Record<UserRole, string> = {
  supervisor_geral: "Supervisor Geral",
  supervisor_adjunto: "Supervisor Adjunto",
  tecnico: "Técnico",
  estagiario: "Estagiário",
  comercial: "Comercial",
  financeiro: "Financeiro",
};

export const departmentDisplayNames: Record<Department, string> = {
  comercial: "Comercial",
  financeiro: "Financeiro",
  suporte: "Suporte",
};

export const priorityDisplayNames: Record<TaskPriority, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export const statusDisplayNames: Record<TaskStatus, string> = {
  novo: "Novo",
  em_andamento: "Em Andamento",
  em_revisao: "Em Revisão",
  concluido: "Concluído",
  bloqueado: "Bloqueado",
};

export const priorityColors: Record<TaskPriority, string> = {
  urgent: "#EF4444",
  high: "#F2C94C",
  medium: "#3B82F6",
  low: "#22C55E",
};

export const statusColors: Record<TaskStatus, string> = {
  novo: "#A855F7",
  em_andamento: "#3B82F6",
  em_revisao: "#F97316",
  concluido: "#22C55E",
  bloqueado: "#EF4444",
};

export const departmentColors: Record<Department, string> = {
  comercial: "#A855F7",
  financeiro: "#22C55E",
  suporte: "#F2C94C",
};

export const roleDepartmentMap: Record<UserRole, Department> = {
  supervisor_geral: "suporte",
  supervisor_adjunto: "suporte",
  tecnico: "suporte",
  estagiario: "suporte",
  comercial: "comercial",
  financeiro: "financeiro",
};

export const statusOrder: TaskStatus[] = [
  "novo",
  "em_andamento",
  "em_revisao",
  "concluido",
  "bloqueado",
];

export const priorityOrder: TaskPriority[] = ["urgent", "high", "medium", "low"];
