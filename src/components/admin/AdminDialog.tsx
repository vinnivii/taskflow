import { useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function AdminDialog({ title, description, confirmLabel, disabled, onClose, onConfirm, children, destructive = true }: {
  title: string; description: string; confirmLabel: string; disabled?: boolean; onClose: () => void;
  onConfirm: () => Promise<string | null>; children: ReactNode; destructive?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  return <Dialog open onOpenChange={(open) => { if (!open && !pending.current) onClose(); }}>
    <DialogContent showCloseButton={false} style={{ animation: "none", transform: "translate(-50%, -50%)" }} className="bg-[var(--c-surface)] text-[var(--c-text)] border-[var(--c-border)] max-h-[90dvh] overflow-y-auto">
      <DialogTitle>{title}</DialogTitle><DialogDescription className="text-[var(--c-muted)]">{description}</DialogDescription>
      <form className="space-y-4" onSubmit={async (event) => {
        event.preventDefault(); if (disabled || pending.current) return;
        pending.current = true; setBusy(true); setError("");
        try { const message = await onConfirm(); if (message) setError(message); else onClose(); }
        catch { setError("Não foi possível concluir a operação. Tente novamente."); }
        finally { pending.current = false; setBusy(false); }
      }}>
        <fieldset disabled={busy} className="space-y-4">{children}</fieldset>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <DialogFooter className="gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="px-4 py-2 rounded-md border border-[var(--c-border)] text-sm disabled:opacity-50">Cancelar</button>
          <button disabled={busy || disabled} className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 ${destructive ? "bg-red-600 text-white" : "bg-[#F2C94C] text-black"}`}>
            {busy && <Loader2 size={15} className="animate-spin" />}{busy ? "Processando…" : confirmLabel}
          </button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
