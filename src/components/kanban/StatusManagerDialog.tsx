import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useStore } from "@/store/useStore";
import { ColumnsManager } from "./ColumnsManager";

export function StatusManagerDialog({ kanbanId, initialCreating, onClose, onReturnFocus }: {
  kanbanId: string; initialCreating: boolean; onClose: () => void; onReturnFocus: () => void;
}) {
  const activeKanbanId = useStore((state) => state.activeKanbanId);
  const permissions = usePermissions();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  if (!permissions.canManageKanbans || activeKanbanId !== kanbanId) return null;
  return <Dialog open onOpenChange={(open) => { if (!open && !pending.current) onClose(); }}>
    <DialogContent showCloseButton={false} style={{ animation: "none", transform: "translate(-50%, -50%)" }}
      className="bg-[var(--c-surface)] text-[var(--c-text)] border-[var(--c-border)] max-h-[90dvh] overflow-y-auto sm:max-w-xl"
      onCloseAutoFocus={(event) => { event.preventDefault(); onReturnFocus(); }}>
      <DialogTitle>Gerenciar status</DialogTitle>
      <DialogDescription className="text-[var(--c-muted)]">Os status são as colunas deste Kanban. As alterações aparecem no quadro sem salvar os dados da tarefa aberta.</DialogDescription>
      <ColumnsManager terminology="status" initialCreating={initialCreating} onBusyChange={(value) => { pending.current = value; setBusy(value); }} />
      <button type="button" disabled={busy} onClick={onClose} className="justify-self-end px-4 py-2 rounded-md border border-[var(--c-border)] text-sm disabled:opacity-40">Fechar gerenciamento</button>
    </DialogContent>
  </Dialog>;
}
