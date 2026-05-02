import { useState, useMemo, useEffect } from "react";
import { ArrowUp, ArrowDown, Minus, Clock, AlertTriangle, Users, CalendarDays, X } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/store/useStore";
import { supabase } from "@/utils/supabase";
import { departmentDisplayNames, priorityColors, priorityDisplayNames } from "@/types";
import type { Department, TaskPriority, ActivityEntry } from "@/types";

type DateRange = "all" | "today" | "week" | "month" | "custom";

const deptColors: Record<Department, string> = {
  suporte: "#F2C94C",
  comercial: "#A855F7",
  financeiro: "#22C55E",
};

export function Relatorios() {
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [appliedCustomStart, setAppliedCustomStart] = useState<Date | null>(null);
  const [appliedCustomEnd, setAppliedCustomEnd] = useState<Date | null>(null);

  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const boards = useStore((s) => s.boards);
  const [recentActivityFeed, setRecentActivityFeed] = useState<(ActivityEntry & { taskTitle: string })[]>([]);

  useEffect(() => {
    async function loadActivity() {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, task_id, user_id, action, details, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error || !data) return;
      const entries = data.map((row) => {
        const task = tasks.find((t) => t.id === row.task_id);
        return {
          id: row.id,
          taskId: row.task_id,
          userId: row.user_id,
          action: row.action as ActivityEntry["action"],
          details: row.details,
          createdAt: new Date(row.created_at),
          taskTitle: task?.title ?? "",
        };
      });
      setRecentActivityFeed(entries);
    }
    void loadActivity();
  }, [tasks]);

  const { startDate, endDate, prevStartDate, prevEndDate } = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case "all": {
        const s = new Date(0);
        const e = new Date(8640000000000000);
        return { startDate: s, endDate: e, prevStartDate: s, prevEndDate: e };
      }
      case "today": {
        const s = startOfDay(now);
        const e = endOfDay(now);
        const ps = startOfDay(new Date(now.getTime() - 86400000));
        const pe = endOfDay(new Date(now.getTime() - 86400000));
        return { startDate: s, endDate: e, prevStartDate: ps, prevEndDate: pe };
      }
      case "week": {
        const s = startOfWeek(now, { locale: ptBR });
        const e = endOfWeek(now, { locale: ptBR });
        const ps = new Date(s.getTime() - 7 * 86400000);
        const pe = new Date(e.getTime() - 7 * 86400000);
        return { startDate: s, endDate: e, prevStartDate: ps, prevEndDate: pe };
      }
      case "custom": {
        const s = appliedCustomStart ?? startOfMonth(now);
        const e = appliedCustomEnd ?? endOfMonth(now);
        const diff = e.getTime() - s.getTime();
        const ps = new Date(s.getTime() - diff);
        const pe = new Date(s.getTime() - 1);
        return { startDate: s, endDate: e, prevStartDate: ps, prevEndDate: pe };
      }
      case "month":
      default: {
        const s = startOfMonth(now);
        const e = endOfMonth(now);
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const ps = startOfMonth(prevMonth);
        const pe = endOfMonth(prevMonth);
        return { startDate: s, endDate: e, prevStartDate: ps, prevEndDate: pe };
      }
    }
  }, [dateRange, appliedCustomStart, appliedCustomEnd]);

  const filteredTasks = useMemo(() =>
    tasks.filter((t) => !t.archived && t.createdAt >= startDate && t.createdAt <= endDate),
    [tasks, startDate, endDate]
  );

  const prevTasks = useMemo(() =>
    tasks.filter((t) => !t.archived && t.createdAt >= prevStartDate && t.createdAt <= prevEndDate),
    [tasks, prevStartDate, prevEndDate]
  );

  const concludedKey = boards.find((b) => b.key === "concluido")?.key ?? "concluido";

  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter((t) => t.status === concludedKey).length;
    const pending = total - completed;
    const overdue = filteredTasks.filter(
      (t) => t.dueDate && t.dueDate < new Date() && t.status !== concludedKey
    ).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const completedTasks = filteredTasks.filter((t) => t.status === concludedKey);
    const avgTime = completedTasks.length > 0
      ? (completedTasks.reduce((sum, t) => {
          return sum + Math.max(1, Math.ceil((t.updatedAt.getTime() - t.createdAt.getTime()) / 86400000));
        }, 0) / completedTasks.length).toFixed(1)
      : "0";

    const prevTotal = prevTasks.length;
    const prevCompleted = prevTasks.filter((t) => t.status === concludedKey).length;
    const totalDiff = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
    const completedDiff = prevCompleted > 0 ? Math.round(((completed - prevCompleted) / prevCompleted) * 100) : null;

    return { total, completed, pending, overdue, completionRate, avgTime, totalDiff, completedDiff };
  }, [filteredTasks, prevTasks, concludedKey]);

  const statusDistribution = useMemo(() => {
    const dist: Record<string, number> = Object.fromEntries(boards.map((b) => [b.key, 0]));
    for (const t of filteredTasks) {
      if (dist[t.status] !== undefined) dist[t.status]++;
    }
    const maxCount = Math.max(...Object.values(dist), 1);
    return { dist, maxCount };
  }, [filteredTasks, boards]);

  const priorityDistribution = useMemo(() => {
    const dist: Record<TaskPriority, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
    for (const t of filteredTasks) dist[t.priority]++;
    const max = Math.max(...Object.values(dist), 1);
    return { dist, max };
  }, [filteredTasks]);

  const deptDistribution = useMemo(() => {
    const dist: Record<Department, number> = { suporte: 0, comercial: 0, financeiro: 0 };
    for (const t of filteredTasks) dist[t.department]++;
    return dist;
  }, [filteredTasks]);
  const deptTotal = filteredTasks.length;

  const memberStats = useMemo(() => {
    return users.map((u) => {
      const assigned = filteredTasks.filter((t) => t.assigneeId === u.id);
      const done = assigned.filter((t) => t.status === concludedKey).length;
      const overdueCount = assigned.filter(
        (t) => t.dueDate && t.dueDate < new Date() && t.status !== concludedKey
      ).length;
      const rate = assigned.length > 0 ? Math.round((done / assigned.length) * 100) : 0;
      return { user: u, total: assigned.length, done, overdueCount, rate };
    }).filter((s) => s.total > 0).sort((a, b) => b.total - a.total);
  }, [filteredTasks, users, concludedKey]);

  const recentActivity = useMemo(() => {
    return recentActivityFeed
      .filter((a) => a.createdAt >= startDate && a.createdAt <= endDate)
      .slice(0, 12);
  }, [recentActivityFeed, startDate, endDate]);

  const rangeOptions: { value: DateRange; label: string }[] = [
    { value: "all", label: "Tudo" },
    { value: "today", label: "Hoje" },
    { value: "week", label: "Esta semana" },
    { value: "month", label: "Este mes" },
  ];

  const customLabel = appliedCustomStart && appliedCustomEnd
    ? `${format(appliedCustomStart, "dd/MM/yy")} - ${format(appliedCustomEnd, "dd/MM/yy")}`
    : "Periodo";

  function handleApplyCustom() {
    if (!customStart || !customEnd) return;
    setAppliedCustomStart(startOfDay(new Date(customStart)));
    setAppliedCustomEnd(endOfDay(new Date(customEnd)));
    setDateRange("custom");
    setCustomModalOpen(false);
  }

  const DiffBadge = ({ diff }: { diff: number | null }) => {
    if (diff === null) return <span className="text-[11px] text-[var(--c-muted-2)]">sem dados anteriores</span>;
    if (diff === 0) return <span className="flex items-center gap-1 text-[11px] text-[var(--c-muted-2)]"><Minus size={12} />igual ao anterior</span>;
    return diff > 0
      ? <span className="flex items-center gap-1 text-[11px] text-[#22C55E]"><ArrowUp size={12} />+{diff}% vs anterior</span>
      : <span className="flex items-center gap-1 text-[11px] text-[#EF4444]"><ArrowDown size={12} />{diff}% vs anterior</span>;
  };

  return (
    <AppLayout title="Relatorios">
      {customModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setCustomModalOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl shadow-2xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-[var(--c-text)] tracking-[-0.3px]">Periodo personalizado</h3>
              <button onClick={() => setCustomModalOpen(false)} className="text-[var(--c-muted)] hover:text-[var(--c-text)] transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold tracking-[0.5px] text-[var(--c-muted)] uppercase mb-1.5 block">Data inicial</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full h-9 px-3 rounded-md bg-[var(--c-surface-3)] border border-[var(--c-border)] text-[13px] text-[var(--c-text)] focus:outline-none focus:border-[#F2C94C]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold tracking-[0.5px] text-[var(--c-muted)] uppercase mb-1.5 block">Data final</label>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full h-9 px-3 rounded-md bg-[var(--c-surface-3)] border border-[var(--c-border)] text-[13px] text-[var(--c-text)] focus:outline-none focus:border-[#F2C94C]"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setCustomModalOpen(false)}
                className="flex-1 h-9 rounded-md bg-[var(--c-surface-3)] border border-[var(--c-border)] text-[12px] font-semibold text-[var(--c-muted)] hover:bg-[var(--c-hover)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyCustom}
                disabled={!customStart || !customEnd}
                className="flex-1 h-9 rounded-md bg-[#F2C94C] text-[#0A0A0A] text-[12px] font-semibold disabled:opacity-40 hover:bg-[#F5D76A] transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-[22px] font-semibold text-[var(--c-text)] tracking-[-0.8px]">Relatorios</h1>
        <div className="flex flex-wrap gap-1.5">
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
          <button
            onClick={() => setCustomModalOpen(true)}
            className={`h-8 px-3 rounded-md text-[11px] font-semibold tracking-[0.5px] transition-all flex items-center gap-1.5 ${
              dateRange === "custom"
                ? "bg-[#F2C94C] text-[#0A0A0A]"
                : "bg-[var(--c-surface-3)] text-[var(--c-muted)] border border-[var(--c-border)] hover:bg-[var(--c-hover)]"
            }`}
          >
            <CalendarDays size={12} />
            {customLabel}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-3 md:p-5">
          <div className="text-[28px] md:text-[32px] font-bold text-[var(--c-text)] tracking-[-1.5px] leading-[38px]">{metrics.total}</div>
          <div className="text-[12px] md:text-[13px] text-[var(--c-muted)] mt-1">Total de tarefas</div>
          <div className="mt-2"><DiffBadge diff={metrics.totalDiff} /></div>
        </div>
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-3 md:p-5">
          <div className="text-[28px] md:text-[32px] font-bold text-[var(--c-text)] tracking-[-1.5px] leading-[38px]">{metrics.completed}</div>
          <div className="text-[12px] md:text-[13px] text-[var(--c-muted)] mt-1">Concluidas</div>
          <div className="mt-2">
            <div className="w-full h-1 bg-[var(--c-surface-3)] rounded-full overflow-hidden">
              <div className="h-full bg-[#22C55E] rounded-full transition-all duration-500" style={{ width: `${metrics.completionRate}%` }} />
            </div>
            <span className="text-[11px] text-[var(--c-muted-2)]">{metrics.completionRate}% do total</span>
          </div>
        </div>
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-3 md:p-5">
          <div className="text-[28px] md:text-[32px] font-bold text-[var(--c-text)] tracking-[-1.5px] leading-[38px]">{metrics.avgTime}d</div>
          <div className="text-[12px] md:text-[13px] text-[var(--c-muted)] mt-1">Tempo medio de resolucao</div>
          <div className="mt-2 text-[11px] text-[var(--c-muted-2)]">tasks concluidas</div>
        </div>
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-3 md:p-5">
          <div className="text-[28px] md:text-[32px] font-bold text-[var(--c-text)] tracking-[-1.5px] leading-[38px]">{metrics.pending}</div>
          <div className="text-[12px] md:text-[13px] text-[var(--c-muted)] mt-1">Pendentes</div>
          {metrics.overdue > 0
            ? <div className="flex items-center gap-1 mt-2 text-[11px] text-[#EF4444]"><AlertTriangle size={11} />{metrics.overdue} atrasadas</div>
            : <div className="mt-2 text-[11px] text-[#22C55E]">nenhuma atrasada</div>
          }
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-4 md:p-6">
          <h2 className="text-[16px] font-semibold text-[var(--c-text)] tracking-[-0.4px] mb-4">Tarefas por status</h2>
          <div className="space-y-2.5">
            {boards.map((board) => {
              const count = statusDistribution.dist[board.key] ?? 0;
              const pct = (count / statusDistribution.maxCount) * 100;
              return (
                <div key={board.key} className="flex items-center gap-3">
                  <span className="text-[12px] text-[var(--c-muted)] w-24 md:w-28 shrink-0 truncate">{board.name}</span>
                  <div className="flex-1 h-6 bg-[var(--c-surface-3)] rounded overflow-hidden">
                    <div className="h-full rounded transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: board.color, opacity: 0.85 }} />
                  </div>
                  <span className="text-[11px] text-[var(--c-muted-2)] w-5 text-right shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-4 md:p-6">
          <h2 className="text-[16px] font-semibold text-[var(--c-text)] tracking-[-0.4px] mb-4">Tarefas por prioridade</h2>
          <div className="space-y-2.5">
            {(["urgent", "high", "medium", "low"] as TaskPriority[]).map((p) => {
              const count = priorityDistribution.dist[p];
              const pct = (count / priorityDistribution.max) * 100;
              return (
                <div key={p} className="flex items-center gap-3">
                  <span className="text-[12px] text-[var(--c-muted)] w-24 md:w-28 shrink-0">{priorityDisplayNames[p]}</span>
                  <div className="flex-1 h-6 bg-[var(--c-surface-3)] rounded overflow-hidden">
                    <div className="h-full rounded transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: priorityColors[p], opacity: 0.85 }} />
                  </div>
                  <span className="text-[11px] text-[var(--c-muted-2)] w-5 text-right shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-4 md:p-6">
          <h2 className="text-[16px] font-semibold text-[var(--c-text)] tracking-[-0.4px] mb-4">Tarefas por setor</h2>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-32 h-32 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {(() => {
                  const depts: Department[] = ["suporte", "comercial", "financeiro"];
                  let cum = 0;
                  return depts.map((dept) => {
                    const pct = deptTotal > 0 ? deptDistribution[dept] / deptTotal : 0;
                    const circ = 2 * Math.PI * 35;
                    const node = (
                      <circle key={dept} cx="50" cy="50" r="35" fill="none"
                        stroke={deptColors[dept]} strokeWidth="14"
                        strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
                        strokeDashoffset={-circ * cum}
                        className="transition-all duration-500"
                      />
                    );
                    cum += pct;
                    return node;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[22px] font-bold text-[var(--c-text)]">{deptTotal}</span>
                <span className="text-[10px] text-[var(--c-muted-2)]">tarefas</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 w-full">
              {(["suporte", "comercial", "financeiro"] as Department[]).map((dept) => {
                const count = deptDistribution[dept];
                const pct = deptTotal > 0 ? Math.round((count / deptTotal) * 100) : 0;
                return (
                  <div key={dept}>
                    <div className="flex justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: deptColors[dept] }} />
                        <span className="text-[12px] text-[var(--c-muted)]">{departmentDisplayNames[dept]}</span>
                      </div>
                      <span className="text-[12px] text-[var(--c-muted-2)]">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1 bg-[var(--c-surface-3)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: deptColors[dept] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-[var(--c-muted)]" />
            <h2 className="text-[16px] font-semibold text-[var(--c-text)] tracking-[-0.4px]">Desempenho por membro</h2>
          </div>
          {memberStats.length === 0 ? (
            <p className="text-[13px] text-[var(--c-muted-2)]">Nenhuma tarefa atribuida no periodo</p>
          ) : (
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1" style={{ scrollbarWidth: "none" }}>
              {memberStats.map(({ user, total, done, overdueCount, rate }) => (
                <div key={user.id} className="flex items-center gap-3">
                  <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[12px] font-medium text-[var(--c-text)] truncate">{user.name}</span>
                      <span className="text-[11px] text-[var(--c-muted-2)] shrink-0 ml-2">{done}/{total}</span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--c-surface-3)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500 bg-[#22C55E]" style={{ width: `${rate}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-[var(--c-muted-2)]">{rate}% concluidas</span>
                      {overdueCount > 0 && (
                        <span className="text-[10px] text-[#EF4444] flex items-center gap-0.5">
                          <AlertTriangle size={9} />{overdueCount} atrasada{overdueCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-4 md:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Clock size={16} className="text-[var(--c-muted)]" />
          <h2 className="text-[16px] font-semibold text-[var(--c-text)] tracking-[-0.4px]">Atividade recente</h2>
        </div>
        <p className="text-[12px] text-[var(--c-muted)] mb-4">Ultimas acoes da equipe no periodo</p>
        {recentActivity.length === 0 ? (
          <p className="text-[13px] text-[var(--c-muted-2)]">Sem atividades no periodo</p>
        ) : (
          <div>
            {recentActivity.map((entry) => {
              const user = users.find((u) => u.id === entry.userId);
              return (
                <div key={entry.id} className="flex items-start gap-3 py-2.5 border-b border-[var(--c-border)] last:border-0">
                  {user?.avatar
                    ? <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full shrink-0 mt-0.5" />
                    : <div className="w-7 h-7 rounded-full bg-[var(--c-surface-3)] shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-[var(--c-text)] leading-[18px]">
                      <span className="font-medium">{user?.name ?? "Usuario"}</span>{" "}
                      <span className="text-[var(--c-muted)]">{entry.details.toLowerCase()}</span>
                    </p>
                    <p className="text-[11px] text-[var(--c-muted-2)] mt-0.5 truncate">{entry.taskTitle}</p>
                  </div>
                  <span className="text-[10px] text-[var(--c-muted-2)] shrink-0 mt-0.5">
                    {format(entry.createdAt, "dd/MM HH:mm", { locale: ptBR })}
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
