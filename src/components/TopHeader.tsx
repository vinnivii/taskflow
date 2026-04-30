import { useState } from "react";
import { Search, Plus, Bell, X, Sun, Moon } from "lucide-react";
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
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const perms = usePermissions();

  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  if (!currentUser) return null;

  return (
    <header className="header-light h-16 bg-[var(--c-surface)] border-b border-[var(--c-border)] flex items-center justify-between px-6 shrink-0">
      {/* Left: Page title */}
      <h1 className="text-[24px] font-semibold text-[var(--c-text)] tracking-[-0.8px] leading-[30px]">
        {title}
      </h1>

      {/* Center: Search */}
      <div
        className={`relative transition-all duration-[150ms] ${
          searchFocused ? "w-[400px]" : "w-[300px]"
        }`}
      >
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-muted-2)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Buscar tarefas, IDs ou responsaveis..."
          className="w-full h-9 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-md pl-9 pr-8 text-[14px] text-[var(--c-text)] placeholder:text-[var(--c-muted-2)] outline-none transition-all focus:border-[var(--c-border-2)] focus:shadow-[0_0_0_3px_rgba(242,201,76,0.15)]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--c-muted-2)] hover:text-[var(--c-text)]"
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

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          className="w-9 h-9 flex items-center justify-center text-[var(--c-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] rounded-md transition-colors"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative w-9 h-9 flex items-center justify-center text-[var(--c-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] rounded-md transition-colors"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#EF4444] rounded-full" />
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-12 w-80 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.15)] z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--c-border)] flex items-center justify-between">
                  <span className="text-[var(--c-text)] text-[13px] font-semibold">Notificações</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#EF4444]/10 text-[#EF4444]">
                      {unreadCount} nova{unreadCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[var(--c-muted-2)] text-[13px]">
                    Sem notificações
                  </div>
                ) : (
                  <div className="max-h-[360px] overflow-y-auto">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          markNotificationRead(n.id);
                          setNotifOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 border-b border-[var(--c-border)] hover:bg-[var(--c-hover)] transition-colors flex items-start gap-2.5 ${
                          !n.read ? "bg-[var(--c-surface-2)]" : "bg-[var(--c-surface)]"
                        }`}
                      >
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F2C94C] shrink-0 mt-1.5" />
                        )}
                        <div className={!n.read ? "" : "pl-4"}>
                          <div className="text-[var(--c-text)] text-[13px] font-medium leading-snug">{n.title}</div>
                          <div className="text-[var(--c-muted)] text-[12px] mt-0.5 leading-snug">{n.message}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 hover:bg-[var(--c-hover)] rounded-md p-1 pr-2 transition-colors"
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
              <div className="absolute right-0 top-12 w-48 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.4)] z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--c-border)]">
                  <div className="text-[var(--c-text)] text-[13px] font-medium">{currentUser.name}</div>
                  <div className="text-[var(--c-muted-2)] text-[11px]">{currentUser.email}</div>
                </div>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    useStore.getState().logout();
                  }}
                  className="w-full text-left px-4 py-2.5 text-[#EF4444] text-[13px] hover:bg-[var(--c-surface-3)] transition-colors"
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
