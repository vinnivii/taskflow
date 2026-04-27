import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ListChecks,
  Users,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";

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

  if (!currentUser) return null;

  return (
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

      {/* Bottom: User + Collapse */}
      <div className="p-2 border-t border-[#2A2A2A]">
        {/* User mini profile */}
        <div
          className="flex items-center gap-2 px-2 py-2 rounded-md mb-1 cursor-pointer hover:bg-[#262626] transition-colors"
          onClick={logout}
          title="Sair"
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
                {currentUser.role === "supervisor_geral"
                  ? "Supervisor Geral"
                  : currentUser.role === "supervisor_adjunto"
                  ? "Supervisor Adjunto"
                  : currentUser.role === "tecnico"
                  ? "Tecnico"
                  : currentUser.role === "estagiario"
                  ? "Estagiario"
                  : currentUser.role === "comercial"
                  ? "Comercial"
                  : "Financeiro"}
              </div>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          className="flex items-center justify-center w-full h-8 rounded-md text-[#5A5A5A] hover:text-[#F0F0F0] hover:bg-[#262626] transition-colors"
        >
          {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
    </aside>
  );
}
