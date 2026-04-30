import { useState, useMemo } from "react";
import { Users, Plus, X, Eye, EyeOff, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";

import {
  roleDisplayNames,
  departmentDisplayNames,
  departmentColors,
  roleDepartmentMap,
} from "@/types";
import type { User, UserRole, Department } from "@/types";

export function Equipe() {
  const users = useStore((s) => s.users);
  const tasks = useStore((s) => s.tasks);
  const perms = usePermissions();

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<Department | "all">("all");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const createMember = useStore((s) => s.createMember);
  const addToast = useStore((s) => s.addToast);

  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Create member form
  const [formName, setFormName]           = useState("");
  const [formEmail, setFormEmail]         = useState("");
  const [formPassword, setFormPassword]   = useState("");
  const [formRole, setFormRole]           = useState<UserRole>("tecnico");
  const [showFormPw, setShowFormPw]       = useState(false);
  const [formLoading, setFormLoading]     = useState(false);
  const [formError, setFormError]         = useState("");

  const handleCloseModal = () => {
    setShowInviteModal(false);
    setFormName(""); setFormEmail(""); setFormPassword("");
    setFormRole("tecnico"); setFormError(""); setShowFormPw(false);
  };

  const handleCreateMember = async () => {
    setFormError("");
    if (!formName.trim())           { setFormError("Informe o nome.");              return; }
    if (!formEmail.trim())          { setFormError("Informe o e-mail.");            return; }
    if (formPassword.length < 6)    { setFormError("Senha mínima de 6 caracteres."); return; }

    setFormLoading(true);
    const result = await createMember({
      name: formName.trim(),
      email: formEmail.trim(),
      password: formPassword,
      role: formRole,
      department: roleDepartmentMap[formRole],
    });
    setFormLoading(false);

    if (!result.success) {
      setFormError(result.error ?? "Erro ao criar membro.");
      return;
    }

    addToast({ type: "success", title: "Membro criado", message: `${formName.trim()} foi adicionado ao sistema.` });
    handleCloseModal();
  };

  // Filter members
  const filteredMembers = useMemo(() => {
    let result = [...users];

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
          <h1 className="text-[24px] font-semibold text-[var(--c-text)] tracking-[-0.8px]">
            Equipe
          </h1>
          <span className="text-[13px] text-[var(--c-muted)]">
            {filteredMembers.length} membros
          </span>
        </div>
        {perms.canManageUsers && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 h-9 px-4 bg-[#F2C94C] text-[#0A0A0A] text-[13px] font-semibold rounded-md hover:bg-[#F5D76A] transition-all hover:-translate-y-px"
          >
            <Plus size={16} />
            Criar membro
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
          className="w-80 h-9 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-md px-3 text-[14px] text-[var(--c-text)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)]"
        />
        <div className="flex gap-1">
          {deptOptions.map((d) => (
            <button
              key={d.value}
              onClick={() => setDeptFilter(d.value as Department | "all")}
              className={`h-8 px-3 rounded-md text-[11px] font-semibold tracking-[0.5px] transition-all ${
                deptFilter === d.value
                  ? "bg-[#F2C94C] text-[#0A0A0A]"
                  : "bg-[var(--c-surface-3)] text-[var(--c-muted)] border border-[var(--c-border)] hover:bg-[var(--c-hover)]"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
          className="h-8 px-3 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-md text-[11px] font-medium text-[var(--c-text)] outline-none cursor-pointer"
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
          <Users size={64} className="text-[var(--c-muted-2)] mb-4" />
          <h2 className="text-[18px] font-semibold text-[var(--c-muted)]">
            Nenhum membro encontrado
          </h2>
          <p className="text-[13px] text-[var(--c-muted-2)] mt-2">
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
                className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-6 flex flex-col items-center text-center hover:border-[var(--c-border-2)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 transition-all duration-[250ms] text-left"
              >
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-16 h-16 rounded-full mb-4"
                />
                <h3 className="text-[15px] font-semibold text-[var(--c-text)] tracking-[-0.3px] truncate max-w-full">
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
                <div className="flex items-center justify-around w-full mt-5 pt-4 border-t border-[var(--c-border)]">
                  <div className="text-center">
                    <div className="text-[18px] font-semibold text-[var(--c-text)]">
                      {stats.active}
                    </div>
                    <div className="text-[11px] text-[var(--c-muted-2)]">Ativas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[18px] font-semibold text-[var(--c-text)]">
                      {stats.completed}
                    </div>
                    <div className="text-[11px] text-[var(--c-muted-2)]">Concluidas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[18px] font-semibold text-[var(--c-text)]">
                      {stats.active + stats.completed > 0
                        ? `${((stats.completed / (stats.active + stats.completed)) * 100).toFixed(0)}%`
                        : "0%"}
                    </div>
                    <div className="text-[11px] text-[var(--c-muted-2)]">Taxa</div>
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
            className="relative bg-[var(--c-surface)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] max-w-[480px] w-[90vw] max-h-[80vh] overflow-y-auto p-6 animate-in zoom-in-95 fade-in duration-350"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md text-[var(--c-muted-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)]"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center mb-6">
              <img
                src={selectedMember.avatar}
                alt={selectedMember.name}
                className="w-16 h-16 rounded-full mb-3"
              />
              <h2 className="text-[24px] font-semibold text-[var(--c-text)] tracking-[-0.8px]">
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
              <h3 className="text-[15px] font-semibold text-[var(--c-text)] mb-3">
                Tarefas atribuidas
              </h3>
              {(() => {
                const memberTasks = tasks.filter(
                  (t) => t.assigneeId === selectedMember.id,
                );
                if (memberTasks.length === 0) {
                  return (
                    <p className="text-[13px] text-[var(--c-muted-2)]">
                      Nenhuma tarefa atribuida
                    </p>
                  );
                }
                return (
                  <div className="space-y-2">
                    {memberTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 p-2 rounded-md bg-[var(--c-surface-3)]"
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
                        <span className="text-[13px] text-[var(--c-text)] flex-1 truncate">
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

      {/* Create Member Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={handleCloseModal}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative bg-[var(--c-surface)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] max-w-[400px] w-[90vw] p-6 animate-in zoom-in-95 fade-in duration-350"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md text-[var(--c-muted-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)]"
            >
              <X size={18} />
            </button>

            <h2 className="text-[20px] font-semibold text-[var(--c-text)] tracking-[-0.6px] mb-5">
              Criar membro
            </h2>

            <div className="space-y-3">
              {formError && (
                <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-md px-3 py-2">
                  <p className="text-[#EF4444] text-[12px]">{formError}</p>
                </div>
              )}

              {/* Nome */}
              <div>
                <label className="text-[10px] font-semibold tracking-[0.5px] text-[var(--c-muted)] uppercase mb-1.5 block">
                  Nome completo
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => { setFormName(e.target.value); setFormError(""); }}
                  placeholder="Ex: João Silva"
                  className="w-full h-10 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-md px-3 text-[13px] text-[var(--c-text)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)]"
                />
              </div>

              {/* E-mail */}
              <div>
                <label className="text-[10px] font-semibold tracking-[0.5px] text-[var(--c-muted)] uppercase mb-1.5 block">
                  E-mail
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => { setFormEmail(e.target.value); setFormError(""); }}
                  placeholder="email@softcom.com"
                  className="w-full h-10 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-md px-3 text-[13px] text-[var(--c-text)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)]"
                />
              </div>

              {/* Senha */}
              <div>
                <label className="text-[10px] font-semibold tracking-[0.5px] text-[var(--c-muted)] uppercase mb-1.5 block">
                  Senha inicial
                </label>
                <div className="relative">
                  <input
                    type={showFormPw ? "text" : "password"}
                    value={formPassword}
                    onChange={(e) => { setFormPassword(e.target.value); setFormError(""); }}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full h-10 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-md px-3 pr-10 text-[13px] text-[var(--c-text)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPw(!showFormPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--c-muted-2)] hover:text-[var(--c-text)] transition-colors"
                  >
                    {showFormPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Cargo */}
              <div>
                <label className="text-[10px] font-semibold tracking-[0.5px] text-[var(--c-muted)] uppercase mb-1.5 block">
                  Cargo
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="w-full h-10 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-md px-3 text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-border-2)] cursor-pointer"
                >
                  {roleOptions
                    .filter((r) => r.value !== "all")
                    .map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                </select>
              </div>

              {/* Departamento (auto) */}
              <div className="flex items-center gap-2 px-3 py-2 bg-[var(--c-surface-2)] rounded-md border border-[var(--c-border)]">
                <span className="text-[11px] text-[var(--c-muted-2)]">Departamento:</span>
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: departmentColors[roleDepartmentMap[formRole]] }}
                >
                  {departmentDisplayNames[roleDepartmentMap[formRole]]}
                </span>
                <span className="text-[10px] text-[#3A3A3A] ml-auto">definido pelo cargo</span>
              </div>

              <button
                onClick={() => void handleCreateMember()}
                disabled={formLoading}
                className="w-full h-10 bg-[#F2C94C] text-[#0A0A0A] text-[13px] font-semibold rounded-md hover:bg-[#F5D76A] transition-colors mt-1 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {formLoading ? <Loader2 size={15} className="animate-spin" /> : "Criar membro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
