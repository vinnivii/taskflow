import { useState, useMemo, useEffect } from "react";
import { BarChart3, ArrowUp, ArrowDown } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/store/useStore";

import { statusColors, statusDisplayNames, departmentDisplayNames } from "@/types";
import type { TaskStatus, Department } from "@/types";

type DateRange = "today" | "week" | "month" | "custom";

export function Relatorios() {
  const [dateRange, setDateRange] = useState<DateRange>("month");

  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);

  // Calculate date bounds
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return { startDate: now, endDate: now };
      case "week":
        return { startDate: startOfWeek(now, { locale: ptBR }), endDate: endOfWeek(now, { locale: ptBR }) };
      case "month":
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      default:
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    }
  }, [dateRange]);

  // Filter tasks by date range
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const taskDate = t.createdAt;
      return taskDate >= startDate && taskDate <= endDate;
    });
  }, [tasks, startDate, endDate]);

  // Summary metrics
  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter((t) => t.status === "concluido").length;
    const pending = total - completed;
    const overdue = filteredTasks.filter(
      (t) => t.dueDate && t.dueDate < new Date() && t.status !== "concluido"
    ).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Avg resolution time (mock calculation)
    const completedTasks = filteredTasks.filter((t) => t.status === "concluido");
    const avgTime =
      completedTasks.length > 0
        ? (
            completedTasks.reduce((sum, t) => {
              const days = Math.ceil(
                (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60 * 24)
              );
              return sum + days;
            }, 0) / completedTasks.length
          ).toFixed(1)
        : "0";

    return { total, completed, pending, overdue, completionRate, avgTime };
  }, [filteredTasks]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    const dist: Record<TaskStatus, number> = {
      novo: 0,
      em_andamento: 0,
      em_revisao: 0,
      concluido: 0,
      bloqueado: 0,
    };
    for (const t of filteredTasks) {
      dist[t.status]++;
    }
    const maxCount = Math.max(...Object.values(dist), 1);
    return { dist, maxCount };
  }, [filteredTasks]);

  // Department distribution
  const deptDistribution = useMemo(() => {
    const dist: Record<Department, number> = { suporte: 0, comercial: 0, financeiro: 0 };
    for (const t of filteredTasks) {
      dist[t.department]++;
    }
    return dist;
  }, [filteredTasks]);

  const deptTotal = filteredTasks.length;
  const deptColors: Record<Department, string> = {
    suporte: "#F2C94C",
    comercial: "#A855F7",
    financeiro: "#22C55E",
  };

  // Recent activity (last 10)
  const recentActivity = useMemo(() => {
    const allActivity = filteredTasks.flatMap((t) =>
      (t.activityLog ?? []).map((a) => ({ ...a, taskTitle: t.title, taskId: t.id }))
    );
    allActivity.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return allActivity.slice(0, 10);
  }, [filteredTasks]);

  const rangeOptions: { value: DateRange; label: string }[] = [
    { value: "today", label: "Hoje" },
    { value: "week", label: "Esta semana" },
    { value: "month", label: "Este mes" },
  ];

  return (
    <AppLayout title="Relatorios">
      {/* Header with date range */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[24px] font-semibold text-[var(--c-text)] tracking-[-0.8px]">
          Relatorios
        </h1>
        <div className="flex gap-2">
          {rangeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={`h-8 px-3 rounded-md text-[11px] font-semibold tracking-[0.5px] transition-all ${
                dateRange === opt.value
                  ? "bg-[#F2C94C] text-[#0A0A0A]"
                  : "bg-[var(--c-surface-3)] text-[var(--c-muted)] border border-[var(--c-border)] hover:bg-[var(--c-hover)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total tasks */}
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-5">
          <div className="text-[32px] font-bold text-[var(--c-text)] tracking-[-1.5px] leading-[38px]">
            {metrics.total}
          </div>
          <div className="text-[13px] text-[var(--c-muted)] mt-1">Total de tarefas</div>
          <div className="flex items-center gap-1 mt-2 text-[#22C55E]">
            <ArrowUp size={14} />
            <span className="text-[11px] font-medium tracking-[0.5px]">+12% vs anterior</span>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-5">
          <div className="text-[32px] font-bold text-[var(--c-text)] tracking-[-1.5px] leading-[38px]">
            {metrics.completed}
          </div>
          <div className="text-[13px] text-[var(--c-muted)] mt-1">Concluidas</div>
          <div className="mt-2">
            <div className="w-full h-1 bg-[var(--c-surface-3)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#22C55E] rounded-full transition-all duration-600"
                style={{ width: `${metrics.completionRate}%` }}
              />
            </div>
            <span className="text-[11px] text-[var(--c-muted-2)] mt-1">
              {metrics.completionRate}% do total
            </span>
          </div>
        </div>

        {/* Avg time */}
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-5">
          <div className="text-[32px] font-bold text-[var(--c-text)] tracking-[-1.5px] leading-[38px]">
            {metrics.avgTime}d
          </div>
          <div className="text-[13px] text-[var(--c-muted)] mt-1">
            Tempo medio de resolucao
          </div>
          <div className="flex items-center gap-1 mt-2 text-[#22C55E]">
            <ArrowDown size={14} />
            <span className="text-[11px] font-medium tracking-[0.5px]">-0.3d vs anterior</span>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-5">
          <div className="text-[32px] font-bold text-[var(--c-text)] tracking-[-1.5px] leading-[38px]">
            {metrics.pending}
          </div>
          <div className="text-[13px] text-[var(--c-muted)] mt-1">Pendentes</div>
          <div className="text-[11px] text-[#EF4444] mt-2">
            {metrics.overdue} atrasadas
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Status bar chart */}
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-6">
          <h2 className="text-[18px] font-semibold text-[var(--c-text)] tracking-[-0.5px] mb-4">
            Tarefas por status
          </h2>
          <div className="space-y-3">
            {(["novo", "em_andamento", "em_revisao", "concluido", "bloqueado"] as TaskStatus[]).map(
              (status) => {
                const count = statusDistribution.dist[status];
                const percentage =
                  statusDistribution.maxCount > 0
                    ? (count / statusDistribution.maxCount) * 100
                    : 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="text-[13px] text-[var(--c-muted)] w-28 shrink-0">
                      {statusDisplayNames[status]}
                    </span>
                    <div className="flex-1 h-7 bg-[var(--c-surface-3)] rounded-md overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all duration-600 ease-out"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: statusColors[status],
                          opacity: 0.85,
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-[var(--c-muted-2)] w-6 text-right shrink-0">
                      {count}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* Department donut chart */}
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-6">
          <h2 className="text-[18px] font-semibold text-[var(--c-text)] tracking-[-0.5px] mb-4">
            Tarefas por setor
          </h2>
          <div className="flex items-center justify-center">
            {/* SVG Donut */}
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {(() => {
                  const departments: Department[] = ["suporte", "comercial", "financeiro"];
                  let cumulativePercent = 0;
                  return departments.map((dept) => {
                    const count = deptDistribution[dept];
                    const percent = deptTotal > 0 ? count / deptTotal : 0;
                    const circumference = 2 * Math.PI * 35;
                    const strokeDasharray = `${circumference * percent} ${circumference * (1 - percent)}`;
                    const strokeDashoffset = -circumference * cumulativePercent;
                    cumulativePercent += percent;

                    return (
                      <circle
                        key={dept}
                        cx="50"
                        cy="50"
                        r="35"
                        fill="none"
                        stroke={deptColors[dept]}
                        strokeWidth="12"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-800"
                      />
                    );
                  });
                })()}
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[24px] font-bold text-[var(--c-text)]">{deptTotal}</span>
                <span className="text-[11px] text-[var(--c-muted-2)]">tarefas</span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4">
            {(["suporte", "comercial", "financeiro"] as Department[]).map((dept) => (
              <div key={dept} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: deptColors[dept] }}
                />
                <span className="text-[13px] text-[var(--c-muted)]">
                  {departmentDisplayNames[dept]}
                </span>
                <span className="text-[11px] text-[var(--c-muted-2)]">
                  {deptDistribution[dept]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-6">
        <h2 className="text-[18px] font-semibold text-[var(--c-text)] tracking-[-0.5px] mb-1">
          Atividade recente
        </h2>
        <p className="text-[13px] text-[var(--c-muted)] mb-4">
          Ultimas acoes da equipe
        </p>

        {recentActivity.length === 0 ? (
          <p className="text-[13px] text-[var(--c-muted-2)]">Sem atividades no periodo</p>
        ) : (
          <div className="space-y-0">
            {recentActivity.map((entry) => {
              const user = users.find((u) => u.id === entry.userId) ?? null;
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 py-3 border-b border-[var(--c-border)] last:border-0"
                >
                  <img
                    src={user?.avatar || ""}
                    alt={user?.name || ""}
                    className="w-8 h-8 rounded-full shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] text-[var(--c-text)]">
                      <span className="font-medium">{user?.name}</span>{" "}
                      {entry.details.toLowerCase()}{" "}
                      <span className="text-[#F2C94C]">{entry.taskId}</span>
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--c-muted-2)] shrink-0">
                    {format(entry.createdAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
