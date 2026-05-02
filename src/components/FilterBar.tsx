import { X } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { Department, TaskPriority, TaskStatus } from "@/types";

const departments: { value: Department | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "comercial", label: "Comercial" },
  { value: "financeiro", label: "Financeiro" },
  { value: "suporte", label: "Suporte" },
];

const priorities: { value: TaskPriority | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "urgent", label: "Urgente" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baixa" },
];

interface FilterBarProps {
  showStatusFilter?: boolean;
}

export function FilterBar({ showStatusFilter = false }: FilterBarProps) {
  const filters = useStore((s) => s.filters);
  const setFilter = useStore((s) => s.setFilter);
  const clearFilters = useStore((s) => s.clearFilters);
  const boards = useStore((s) => s.boards);
  const statuses: { value: TaskStatus | "all"; label: string }[] = [
    { value: "all", label: "Todos" },
    ...boards.map((b) => ({ value: b.key as TaskStatus, label: b.name })),
  ];

  const hasActiveFilters =
    filters.department !== "all" ||
    filters.assignee !== "all" ||
    filters.priority !== "all" ||
    (showStatusFilter && filters.status !== "all");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Department pills */}
      <div className="flex items-center gap-1">
        {departments.map((d) => (
          <button
            key={d.value}
            onClick={() => setFilter("department", d.value)}
            className={`h-8 px-3 rounded-md text-[11px] font-semibold tracking-[0.5px] leading-3 transition-all ${
              filters.department === d.value
                ? "bg-[#F2C94C] text-[#0A0A0A]"
                : "bg-[var(--c-surface-3)] text-[var(--c-muted)] border border-[var(--c-border)] hover:bg-[var(--c-hover)]"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Priority dropdown */}
      <select
        value={filters.priority}
        onChange={(e) => setFilter("priority", e.target.value as TaskPriority | "all")}
        className="h-8 px-3 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-md text-[11px] font-medium text-[var(--c-text)] outline-none focus:border-[var(--c-border-2)] cursor-pointer"
      >
        {priorities.map((p) => (
          <option key={p.value} value={p.value}>
            {p.value === "all" ? "Prioridade" : p.label}
          </option>
        ))}
      </select>

      {/* Status dropdown (for list view) */}
      {showStatusFilter && (
        <select
          value={filters.status}
          onChange={(e) => setFilter("status", e.target.value as TaskStatus | "all")}
          className="h-8 px-3 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-md text-[11px] font-medium text-[var(--c-text)] outline-none focus:border-[var(--c-border-2)] cursor-pointer"
        >
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.value === "all" ? "Status" : s.label}
            </option>
          ))}
        </select>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 h-8 px-3 text-[#F2C94C] text-[11px] font-medium hover:underline transition-all"
        >
          <X size={12} />
          Limpar
        </button>
      )}
    </div>
  );
}
