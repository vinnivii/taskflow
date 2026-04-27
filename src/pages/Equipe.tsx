import { useState, useMemo } from "react";
import { Users, Plus, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";
import { mockUsers, mockTasks as tasks } from "@/data/mockData";
import {
  roleDisplayNames,
  departmentDisplayNames,
  departmentColors,
} from "@/types";
import type { User, UserRole, Department } from "@/types";

export function Equipe() {
  const currentUser = useStore((s) => s.currentUser);
  const perms = usePermissions();

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<Department | "all">("all");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Filter members
  const filteredMembers = useMemo(() => {
    let result = [...mockUsers];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((u) => u.name.toLowerCase().includes(q));
    }

    if (deptFilter !== "all") {
      result = result.filter((u) => u.department === deptFilter);
    }

    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }

    return result;
  }, [search, deptFilter, roleFilter]);

  // Calculate member stats
  const getMemberStats = (userId: string) => {
    const userTasks = tasks.filter((t) => t.assigneeId === userId);
    const active = userTasks.filter((t) => t.status !== "concluido").length;
    const completed = userTasks.filter((t) => t.status === "concluido").length;
    return { active, completed };
  };

  const deptOptions: { value: Department | "all"; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "suporte", label: "Suporte" },
    { value: "comercial", label: "Comercial" },
    { value: "financeiro", label: "Financeiro" },
  ];

  const roleOptions: { value: UserRole | "all"; label: string }[] = [
    { value: "all", label: "Todos os cargos" },
    { value: "supervisor_geral", label: "Supervisor Geral" },
    { value: "supervisor_adjunto", label: "Supervisor Adjunto" },
    { value: "tecnico", label: "Tecnico" },
    { value: "estagiario", label: "Estagiario" },
    { value: "comercial", label: "Comercial" },
    { value: "financeiro", label: "Financeiro" },
  ];

  return (
    <AppLayout title="Equipe">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-[24px] font-semibold text-[#F0F0F0] tracking-[-0.8px]">
            Equipe
          </h1>
          <span className="text-[13px] text-[#8A8A8A]">
            {filteredMembers.length} membros
          </span>
        </div>
        {perms.canManageUsers && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 h-9 px-4 bg-[#F2C94C] text-[#0A0A0A] text-[13px] font-semibold rounded-md hover:bg-[#F5D76A] transition-all hover:-translate-y-px"
          >
            <Plus size={16} />
            Convidar membro
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome..."
          className="w-80 h-9 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md px-3 text-[14px] text-[#F0F0F0] placeholder:text-[#5A5A5A] outline-none focus:border-[#3A3A3A]"
        />
        <div className="flex gap-1">
          {deptOptions.map((d) => (
            <button
              key={d.value}
              onClick={() => setDeptFilter(d.value as Department | "all")}
              className={`h-8 px-3 rounded-md text-[11px] font-semibold tracking-[0.5px] transition-all ${
                deptFilter === d.value
                  ? "bg-[#F2C94C] text-[#0A0A0A]"
                  : "bg-[#1E1E1E] text-[#8A8A8A] border border-[#2A2A2A] hover:bg-[#262626]"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
          className="h-8 px-3 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md text-[11px] font-medium text-[#F0F0F0] outline-none cursor-pointer"
        >
          {roleOptions.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Member Grid */}
      {filteredMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Users size={64} className="text-[#5A5A5A] mb-4" />
          <h2 className="text-[18px] font-semibold text-[#8A8A8A]">
            Nenhum membro encontrado
          </h2>
          <p className="text-[13px] text-[#5A5A5A] mt-2">
            Tente ajustar os filtros
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => {
            const stats = getMemberStats(member.id);
            return (
              <button
                key={member.id}
                onClick={() => setSelectedMember(member)}
                className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-6 flex flex-col items-center text-center hover:border-[#3A3A3A] hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 transition-all duration-[250ms] text-left"
              >
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-16 h-16 rounded-full mb-4"
                />
                <h3 className="text-[15px] font-semibold text-[#F0F0F0] tracking-[-0.3px] truncate max-w-full">
                  {member.name}
                </h3>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-[0.5px] mt-2"
                  style={{
                    backgroundColor: "rgba(242, 201, 76, 0.12)",
                    color: "#F2C94C",
                    border: "1px solid rgba(242, 201, 76, 0.3)",
                  }}
                >
                  {roleDisplayNames[member.role]}
                </span>
                <span
                  className="text-[11px] mt-1"
                  style={{ color: departmentColors[member.department] }}
                >
                  {departmentDisplayNames[member.department]}
                </span>

                {/* Stats */}
                <div className="flex items-center justify-around w-full mt-5 pt-4 border-t border-[#2A2A2A]">
                  <div className="text-center">
                    <div className="text-[18px] font-semibold text-[#F0F0F0]">
                      {stats.active}
                    </div>
                    <div className="text-[11px] text-[#5A5A5A]">Ativas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[18px] font-semibold text-[#F0F0F0]">
                      {stats.completed}
                    </div>
                    <div className="text-[11px] text-[#5A5A5A]">Concluidas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[18px] font-semibold text-[#F0F0F0]">
                      {stats.active + stats.completed > 0
                        ? `${((stats.completed / (stats.active + stats.completed)) * 100).toFixed(0)}%`
                        : "0%"}
                    </div>
                    <div className="text-[11px] text-[#5A5A5A]">Taxa</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Member Detail Modal */}
      {selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setSelectedMember(null)}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative bg-[#141414] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] max-w-[480px] w-[90vw] max-h-[80vh] overflow-y-auto p-6 animate-in zoom-in-95 fade-in duration-350"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md text-[#5A5A5A] hover:text-[#F0F0F0] hover:bg-[#262626]"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center mb-6">
              <img
                src={selectedMember.avatar}
                alt={selectedMember.name}
                className="w-16 h-16 rounded-full mb-3"
              />
              <h2 className="text-[24px] font-semibold text-[#F0F0F0] tracking-[-0.8px]">
                {selectedMember.name}
              </h2>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-[0.5px] mt-1"
                style={{
                  backgroundColor: "rgba(242, 201, 76, 0.12)",
                  color: "#F2C94C",
                }}
              >
                {roleDisplayNames[selectedMember.role]}
              </span>
              <span
                className="text-[13px] mt-1"
                style={{ color: departmentColors[selectedMember.department] }}
              >
                {departmentDisplayNames[selectedMember.department]}
              </span>
            </div>

            {/* Member tasks */}
            <div>
              <h3 className="text-[15px] font-semibold text-[#F0F0F0] mb-3">
                Tarefas atribuidas
              </h3>
              {(() => {
                const memberTasks = tasks.filter(
                  (t) => t.assigneeId === selectedMember.id,
                );
                if (memberTasks.length === 0) {
                  return (
                    <p className="text-[13px] text-[#5A5A5A]">
                      Nenhuma tarefa atribuida
                    </p>
                  );
                }
                return (
                  <div className="space-y-2">
                    {memberTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 p-2 rounded-md bg-[#1E1E1E]"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              task.priority === "urgent"
                                ? "#EF4444"
                                : task.priority === "high"
                                  ? "#F2C94C"
                                  : task.priority === "medium"
                                    ? "#3B82F6"
                                    : "#22C55E",
                          }}
                        />
                        <span className="text-[13px] text-[#F0F0F0] flex-1 truncate">
                          {task.title}
                        </span>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${
                              task.status === "novo"
                                ? "#A855F7"
                                : task.status === "em_andamento"
                                  ? "#3B82F6"
                                  : task.status === "em_revisao"
                                    ? "#F97316"
                                    : task.status === "concluido"
                                      ? "#22C55E"
                                      : "#EF4444"
                            }26`,
                            color:
                              task.status === "novo"
                                ? "#A855F7"
                                : task.status === "em_andamento"
                                  ? "#3B82F6"
                                  : task.status === "em_revisao"
                                    ? "#F97316"
                                    : task.status === "concluido"
                                      ? "#22C55E"
                                      : "#EF4444",
                          }}
                        >
                          {task.status === "novo"
                            ? "Novo"
                            : task.status === "em_andamento"
                              ? "Em Andamento"
                              : task.status === "em_revisao"
                                ? "Em Revisao"
                                : task.status === "concluido"
                                  ? "Concluido"
                                  : "Bloqueado"}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowInviteModal(false)}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative bg-[#141414] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] max-w-[400px] w-[90vw] p-6 animate-in zoom-in-95 fade-in duration-350"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md text-[#5A5A5A] hover:text-[#F0F0F0] hover:bg-[#262626]"
            >
              <X size={18} />
            </button>

            <h2 className="text-[24px] font-semibold text-[#F0F0F0] tracking-[-0.8px] mb-6">
              Convidar membro
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-medium tracking-[0.5px] text-[#8A8A8A] uppercase mb-1.5 block">
                  Nome
                </label>
                <input
                  type="text"
                  placeholder="Nome completo"
                  className="w-full h-10 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md px-3 text-[14px] text-[#F0F0F0] placeholder:text-[#5A5A5A] outline-none focus:border-[#3A3A3A]"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium tracking-[0.5px] text-[#8A8A8A] uppercase mb-1.5 block">
                  E-mail
                </label>
                <input
                  type="email"
                  placeholder="email@Softcom.com"
                  className="w-full h-10 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md px-3 text-[14px] text-[#F0F0F0] placeholder:text-[#5A5A5A] outline-none focus:border-[#3A3A3A]"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium tracking-[0.5px] text-[#8A8A8A] uppercase mb-1.5 block">
                  Cargo
                </label>
                <select className="w-full h-10 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md px-3 text-[14px] text-[#F0F0F0] outline-none focus:border-[#3A3A3A]">
                  {roleOptions
                    .filter((r) => r.value !== "all")
                    .map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                </select>
              </div>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  useStore.getState().addToast({
                    type: "success",
                    title: "Sucesso",
                    message: "Convite enviado com sucesso",
                  });
                }}
                className="w-full h-10 bg-[#F2C94C] text-[#0A0A0A] text-[13px] font-semibold rounded-md hover:bg-[#F5D76A] transition-colors mt-2"
              >
                Enviar convite
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
