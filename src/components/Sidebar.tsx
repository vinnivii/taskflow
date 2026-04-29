import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ListChecks,
  Users,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { supabase } from "@/utils/supabase";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";
import { roleDisplayNames, departmentDisplayNames } from "@/types";

const navItems = [
  { to: "/quadro", icon: LayoutDashboard, label: "Quadro" },
  { to: "/tarefas", icon: ListChecks, label: "Tarefas" },
  { to: "/equipe", icon: Users, label: "Equipe", permission: "canViewEquipe" as const },
  { to: "/relatorios", icon: BarChart3, label: "Relatorios", permission: "canViewRelatorios" as const },
];

export function Sidebar() {
  const location = useLocation();
  const expanded = useStore((s) => s.sidebarExpanded);
  const toggle = useStore((s) => s.toggleSidebar);
  const currentUser = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);
  const perms = usePermissions();

  const [profileOpen, setProfileOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleCloseProfile = () => {
    setProfileOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setPwError("");
    setPwSuccess(false);
  };

  const handleChangePassword = async () => {
    setPwError("");
    if (newPassword.length < 6) {
      setPwError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("As senhas não coincidem.");
      return;
    }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwLoading(false);
    if (error) {
      setPwError(error.message);
      return;
    }
    setPwSuccess(true);
    setNewPassword("");
    setConfirmPassword("");
  };

  if (!currentUser) return null;

  return (
    <>
      <aside
        className="flex flex-col h-screen bg-[#141414] border-r border-[#2A2A2A] transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] shrink-0"
        style={{ width: expanded ? 220 : 64 }}
      >
        {/* Logo */}
        <div className="flex items-center px-4 h-16 border-b border-[#2A2A2A]">
          <div className="w-9 h-9 rounded-full bg-[#F2C94C] flex items-center justify-center shrink-0">
            <span className="text-[#0A0A0A] font-bold text-lg">S</span>
          </div>
          {expanded && (
            <div className="ml-3 overflow-hidden">
              <div className="text-[#F0F0F0] font-semibold text-[15px] tracking-[-0.3px] leading-5 whitespace-nowrap">
                Softcom
              </div>
              <div className="text-[#5A5A5A] text-[11px] tracking-[0.5px] leading-[14px] whitespace-nowrap">
                TaskFlow
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 flex flex-col gap-1">
          {navItems.map((item) => {
            if (item.permission && !perms[item.permission]) return null;
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive: active }) =>
                  `flex items-center gap-3 px-3 h-10 rounded-md transition-all duration-[150ms] group relative ${
                    active
                      ? "bg-[rgba(242,201,76,0.12)] text-[#F0F0F0] border-l-[3px] border-[#F2C94C]"
                      : "text-[#8A8A8A] hover:bg-[#262626] hover:text-[#F0F0F0] border-l-[3px] border-transparent"
                  }`
                }
              >
                <item.icon size={20} className="shrink-0" />
                {expanded && (
                  <span className="text-[13px] font-medium leading-4 whitespace-nowrap overflow-hidden">
                    {item.label}
                  </span>
                )}
                {!expanded && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-[#262626] text-[#F0F0F0] text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap border border-[#2A2A2A]">
                    {item.label}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom: User + Logout + Collapse */}
        <div className="p-2 border-t border-[#2A2A2A] flex flex-col gap-1">
          {/* User mini profile */}
          <div
            className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-[#262626] transition-colors group relative"
            onClick={() => setProfileOpen(true)}
            title="Ver perfil"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-7 h-7 rounded-full shrink-0"
            />
            {expanded && (
              <div className="overflow-hidden">
                <div className="text-[#F0F0F0] text-[11px] font-medium leading-4 truncate">
                  {currentUser.name}
                </div>
                <div className="text-[#5A5A5A] text-[10px] leading-3 truncate">
                  {roleDisplayNames[currentUser.role]}
                </div>
              </div>
            )}
            {!expanded && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-[#262626] text-[#F0F0F0] text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap border border-[#2A2A2A]">
                Ver perfil
              </div>
            )}
          </div>

          {/* Logout button */}
          <button
            onClick={() => void logout()}
            title="Sair"
            className="flex items-center gap-2 px-2 py-2 rounded-md text-[#5A5A5A] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors group relative w-full"
          >
            <LogOut size={16} className="shrink-0" />
            {expanded && (
              <span className="text-[11px] font-medium">Sair</span>
            )}
            {!expanded && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-[#262626] text-[#F0F0F0] text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap border border-[#2A2A2A]">
                Sair
              </div>
            )}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={toggle}
            className="flex items-center justify-center w-full h-8 rounded-md text-[#5A5A5A] hover:text-[#F0F0F0] hover:bg-[#262626] transition-colors"
          >
            {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </aside>

      {/* Profile modal */}
      {profileOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={handleCloseProfile}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative bg-[#141414] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-[360px] p-6 animate-in zoom-in-95 fade-in duration-350"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseProfile}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md text-[#5A5A5A] hover:text-[#F0F0F0] hover:bg-[#262626] transition-colors"
            >
              <X size={18} />
            </button>

            {/* User info */}
            <div className="flex flex-col items-center mb-6">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-20 h-20 rounded-full mb-4"
              />
              <h2 className="text-[20px] font-semibold text-[#F0F0F0] tracking-[-0.6px]">
                {currentUser.name}
              </h2>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-[0.5px] mt-2"
                style={{
                  backgroundColor: "rgba(242, 201, 76, 0.12)",
                  color: "#F2C94C",
                  border: "1px solid rgba(242, 201, 76, 0.3)",
                }}
              >
                {roleDisplayNames[currentUser.role]}
              </span>
              <span className="text-[13px] text-[#8A8A8A] mt-1">
                {departmentDisplayNames[currentUser.department]}
              </span>
              <span className="text-[12px] text-[#5A5A5A] mt-2">
                {currentUser.email}
              </span>
            </div>

            {/* Password change */}
            <div className="border-t border-[#2A2A2A] pt-5 space-y-3">
              <p className="text-[11px] font-medium tracking-[0.5px] text-[#8A8A8A] uppercase">
                Alterar senha
              </p>

              {pwError && (
                <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-md px-3 py-2">
                  <p className="text-[#EF4444] text-[12px]">{pwError}</p>
                </div>
              )}
              {pwSuccess && (
                <div className="bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-md px-3 py-2">
                  <p className="text-[#22C55E] text-[12px]">Senha alterada com sucesso!</p>
                </div>
              )}

              <div className="relative">
                <input
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPwError(""); setPwSuccess(false); }}
                  placeholder="Nova senha"
                  className="w-full h-10 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md px-3 pr-10 text-[13px] text-[#F0F0F0] placeholder:text-[#5A5A5A] outline-none focus:border-[#3A3A3A]"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5A5A] hover:text-[#F0F0F0] transition-colors"
                >
                  {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showConfirmPw ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPwError(""); setPwSuccess(false); }}
                  placeholder="Confirmar nova senha"
                  className="w-full h-10 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md px-3 pr-10 text-[13px] text-[#F0F0F0] placeholder:text-[#5A5A5A] outline-none focus:border-[#3A3A3A]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(!showConfirmPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5A5A] hover:text-[#F0F0F0] transition-colors"
                >
                  {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <button
                onClick={() => void handleChangePassword()}
                disabled={pwLoading || !newPassword || !confirmPassword}
                className="w-full h-10 bg-[#F2C94C] hover:bg-[#F5D76A] text-[#0A0A0A] text-[13px] font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {pwLoading ? <Loader2 size={16} className="animate-spin" /> : "Salvar nova senha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
