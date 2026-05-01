import { useMemo } from "react";
import type { TaskStatus } from "@/types";
import { useStore } from "@/store/useStore";

export function usePermissions() {
  const currentUser = useStore((state) => state.currentUser);

  const role = currentUser?.role;

  const permissions = useMemo(() => {
    if (!role) {
      return {
        canCreateTask: () => false,
        canCreateInColumn: (_status: TaskStatus) => false,
        canEditTask: (_taskCreatorId?: string, _taskAssigneeId?: string | null) => false,
        canEditTaskModal: () => false,
        canMoveToColumn: (_fromStatus: TaskStatus, _toStatus: TaskStatus) => false,
        canViewEquipe: false,
        canViewRelatorios: false,
        canManageUsers: false,
        canDeleteTask: false,
        canBatchEdit: false,
        canArchiveTask: () => false,
      };
    }

    const canCreateInColumn = (status: TaskStatus): boolean => {
      switch (role) {
        case "supervisor_geral":
        case "supervisor_adjunto":
          return true;
        case "tecnico":
          return status === "em_andamento" || status === "concluido";
        case "estagiario":
          return status === "em_andamento";
        case "comercial":
        case "financeiro":
          return status === "novo";
        default:
          return false;
      }
    };

    const canCreateTask = (): boolean => {
      return ["novo", "em_andamento", "concluido"].some((s) =>
        canCreateInColumn(s as TaskStatus)
      );
    };

    const canEditTask = (
      taskCreatorId?: string,
      taskAssigneeId?: string | null
    ): boolean => {
      if (!currentUser) return false;
      switch (role) {
        case "supervisor_geral":
          return true;
        case "supervisor_adjunto":
          return true;
        case "tecnico":
        case "estagiario":
          return (
            taskCreatorId === currentUser.id ||
            taskAssigneeId === currentUser.id
          );
        case "comercial":
        case "financeiro":
          return taskCreatorId === currentUser.id;
        default:
          return false;
      }
    };

    const canMoveToColumn = (
      fromStatus: TaskStatus,
      toStatus: TaskStatus
    ): boolean => {
      const statusOrder = ["novo", "em_andamento", "em_revisao", "concluido", "bloqueado"];
      const fromIndex = statusOrder.indexOf(fromStatus);
      const toIndex = statusOrder.indexOf(toStatus);

      switch (role) {
        case "supervisor_geral":
          return true;
        case "supervisor_adjunto":
          return toStatus !== "bloqueado";
        case "tecnico":
        case "estagiario":
        case "comercial":
        case "financeiro":
          return toIndex >= fromIndex || (fromStatus === "bloqueado" && toIndex >= 0);
        default:
          return false;
      }
    };

    const canEditTaskModal = (): boolean =>
      role === "supervisor_geral" || role === "supervisor_adjunto";

    return {
      canCreateTask,
      canCreateInColumn,
      canEditTask,
      canEditTaskModal,
      canMoveToColumn,
      canViewEquipe: ["supervisor_geral", "supervisor_adjunto", "tecnico"].includes(role),
      canViewRelatorios: ["supervisor_geral", "supervisor_adjunto"].includes(role),
      canManageUsers: role === "supervisor_geral",
      canDeleteTask: ["supervisor_geral", "supervisor_adjunto"].includes(role),
      canBatchEdit: ["supervisor_geral", "supervisor_adjunto"].includes(role),
      canArchiveTask: () => ["supervisor_geral", "supervisor_adjunto"].includes(role),
    };
  }, [role, currentUser]);

  return permissions;
}
