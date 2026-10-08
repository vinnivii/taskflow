import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { User } from "@/types";
import { useStore } from "@/store/useStore";
import { AdminDialog } from "./AdminDialog";

export function ResetMemberPasswordDialog({ member, onClose }: { member: User; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const store = useStore();
  if (store.currentUser?.role !== "supervisor_geral") return null;
  const valid = password.length >= 6 && password.length <= 1024 && password === confirmation;
  return <AdminDialog title="Alterar senha" description={`Membro: ${member.name}`} confirmLabel="Salvar nova senha" destructive={false} disabled={!valid} onClose={onClose} onConfirm={async () => {
    const result = await store.resetMemberPassword(member.id, password);
    if (!result.success) return result.error ?? "Não foi possível alterar a senha.";
    setPassword(""); setConfirmation("");
    store.addToast({ type: "success", title: "Senha alterada", message: `A nova senha de ${member.name} já pode ser utilizada.` });
    return null;
  }}>
    <label className="block text-sm">Nova senha<input autoFocus autoComplete="new-password" type={show ? "text" : "password"} maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} className="block w-full mt-1 p-2 rounded bg-[var(--c-surface-3)] border border-[var(--c-border)]" /></label>
    <label className="block text-sm">Confirmar nova senha<input autoComplete="new-password" type={show ? "text" : "password"} maxLength={1024} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="block w-full mt-1 p-2 rounded bg-[var(--c-surface-3)] border border-[var(--c-border)]" /></label>
    <button type="button" className="flex items-center gap-2 text-xs" onClick={() => setShow(!show)}>{show ? <EyeOff size={14} /> : <Eye size={14} />}{show ? "Ocultar senha" : "Mostrar senha"}</button>
    <p className="text-xs text-[var(--c-muted)]">Mínimo de 6 caracteres. As regras adicionais do Supabase Auth também se aplicam.</p>
    {confirmation && confirmation !== password && <p role="alert" className="text-sm text-red-400">As senhas devem ser iguais.</p>}
  </AdminDialog>;
}
