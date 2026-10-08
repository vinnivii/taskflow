import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "@/store/useStore";
import { selectActiveKanban } from "@/lib/kanban";

export function KanbanSelector() {
  const kanbans = useStore((state) => state.kanbans);
  const active = useStore(selectActiveKanban);
  const navigate = useNavigate();
  const location = useLocation();
  const closeMobileSidebar = useStore((state) => state.closeMobileSidebar);
  return (
    <select
      aria-label="Kanban atual"
      value={active?.slug ?? ""}
      disabled={!kanbans.length}
      onChange={(event) => {
        const slug = event.target.value;
        if (!kanbans.some((kanban) => kanban.slug === slug)) return;
        const section = location.pathname.split("/")[1];
        const destination = ["tarefas", "relatorios", "configuracoes"].includes(section) ? section : "quadro";
        closeMobileSidebar();
        navigate(`/${destination}/${slug}`);
      }}
      className="h-8 w-[140px] sm:w-[180px] shrink-0 rounded-md border border-[var(--c-border)] bg-[var(--c-surface-3)] px-2 text-[12px] text-[var(--c-text)]"
    >
      {!active && <option value="">Selecionar Kanban</option>}
      {kanbans.map((kanban) => <option key={kanban.id} value={kanban.slug}>{kanban.name}</option>)}
    </select>
  );
}
