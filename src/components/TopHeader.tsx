import { useState } from "react";
import { Search, Plus, Bell, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";

interface TopHeaderProps {
  title: string;
}

export function TopHeader({ title }: TopHeaderProps) {
  const currentUser = useStore((s) => s.currentUser);
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const openTaskModal = useStore((s) => s.openTaskModal);
  const notifications = useStore((s) => s.notifications);
  const unreadCount = useStore((s) => s.unreadCount);
  const markNotificationRead = useStore((s) => s.markNotificationRead);
  const perms = usePermissions();

  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  if (!currentUser) return null;

  return (
    <header className="h-14 bg-[#141414] border-b border-[#2A2A2A] flex items-center justify-between px-6 shrink-0">
      {/* Left: Page title */}
      <h1 className="text-[24px] font-semibold text-[#F0F0F0] tracking-[-0.8px] leading-[30px]">
        {title}
      </h1>

      {/* Center: Search */}
      <div
        className={`relative transition-all duration-[150ms] ${
          searchFocused ? "w-[400px]" : "w-[300px]"
        }`}
      >
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Buscar tarefas, IDs ou responsaveis..."
          className="w-full h-9 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md pl-9 pr-8 text-[14px] text-[#F0F0F0] placeholder:text-[#5A5A5A] outline-none transition-all focus:border-[#3A3A3A] focus:shadow-[0_0_0_3px_rgba(242,201,76,0.15)]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5A5A] hover:text-[#F0F0F0]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        {/* Create Task Button */}
        {perms.canCreateTask() && (
          <button
            onClick={() => openTaskModal("create", null, "novo")}
            className="flex items-center gap-2 h-9 px-4 bg-[#F2C94C] hover:bg-[#F5D76A] text-[#0A0A0A] text-[13px] font-semibold rounded-md transition-all hover:-translate-y-px"
          >
            <Plus size={16} />
            <span>Nova Tarefa</span>
          </button>
        )}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative w-9 h-9 flex items-center justify-center text-[#8A8A8A] hover:text-[#F0F0F0] hover:bg-[#262626] rounded-md transition-colors"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#EF4444] rounded-full" />
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-12 w-80 bg-[#141414] border border-[#2A2A2A] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.4)] z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[#2A2A2A]">
                  <span className="text-[#F0F0F0] text-[13px] font-semibold">Notificacoes</span>
                </div>
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[#5A5A5A] text-[13px]">
                    Sem notificacoes
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        markNotificationRead(n.id);
                        setNotifOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 border-b border-[#2A2A2A] hover:bg-[#1E1E1E] transition-colors ${
                        !n.read ? "bg-[rgba(242,201,76,0.04)]" : ""
                      }`}
                    >
                      <div className="text-[#F0F0F0] text-[13px] font-medium">{n.title}</div>
                      <div className="text-[#8A8A8A] text-[12px] mt-0.5">{n.message}</div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 hover:bg-[#262626] rounded-md p-1 pr-2 transition-colors"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-7 h-7 rounded-full"
            />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-12 w-48 bg-[#141414] border border-[#2A2A2A] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.4)] z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[#2A2A2A]">
                  <div className="text-[#F0F0F0] text-[13px] font-medium">{currentUser.name}</div>
                  <div className="text-[#5A5A5A] text-[11px]">{currentUser.email}</div>
                </div>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    useStore.getState().logout();
                  }}
                  className="w-full text-left px-4 py-2.5 text-[#EF4444] text-[13px] hover:bg-[#1E1E1E] transition-colors"
                >
                  Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
