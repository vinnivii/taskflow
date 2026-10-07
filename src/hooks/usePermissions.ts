import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import { getKanbanPermissions } from "@/lib/kanban";

export function usePermissions() {
  const currentUser = useStore((state) => state.currentUser);
  const columns = useStore((state) => state.columns);
  return useMemo(() => getKanbanPermissions(currentUser, columns), [currentUser, columns]);
}
