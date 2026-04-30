import { useState, useRef } from "react";
import logoImg from "@/assets/logo.png";
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
  Camera,
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
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleCloseProfile = () => {
    setProfileOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setPwError("");
    setPwSuccess(false);
    setAvatarError("");
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (!file.type.startsWith("image/")) {
      setAvatarError("Envie uma imagem válida.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("A imagem deve ter no máximo 2MB.");
      return;
    }

    setAvatarLoading(true);
    setAvatarError("");

    const ext = file.name.split(".").pop();
    const path = `${currentUser.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setAvatarError(uploadError.message);
      setAvatarLoading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: dbError } = await supabase
      .from("users")
      .update({ avatar: avatarUrl })
      .eq("id", currentUser.id);

    if (dbError) {
      setAvatarError(dbError.message);
      setAvatarLoading(false);
      return;
    }

    useStore.setState((s) => ({
      currentUser: s.currentUser ? { ...s.currentUser, avatar: avatarUrl } : null,
      users: s.users.map((u) => (u.id === currentUser.id ? { ...u, avatar: avatarUrl } : u)),
    }));

    setAvatarLoading(false);
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
        className="sidebar-light flex flex-col h-screen bg-[var(--c-surface)] border-r border-[var(--c-border)] transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] shrink-0"
        style={{ width: expanded ? 220 : 64 }}
      >
        {/* Logo */}
        <div className="flex items-center px-4 h-16 border-b border-[var(--c-border)]">
          <img
            src={logoImg}
            alt="Softcom"
            className="w-9 h-9 rounded-full shrink-0 object-cover"
          />
          {expanded && (
            <div className="ml-3 overflow-hidden">
              <div className="text-[var(--c-text)] font-semibold text-[15px] tracking-[-0.3px] leading-5 whitespace-nowrap">
                {import.meta.env.VITE_APP_NAME_EMPRESA}
              </div>
              <div className="text-[var(--c-muted-2)] text-[11px] tracking-[0.5px] leading-[14px] whitespace-nowrap">
                {import.meta.env.VITE_APP_NAME}
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
                      ? "bg-[rgba(242,201,76,0.12)] text-[var(--c-text)] border-l-[3px] border-[#F2C94C]"
                      : "text-[var(--c-muted)] hover:bg-[var(--c-hover)] hover:text-[var(--c-text)] border-l-[3px] border-transparent"
                  }`
                }
              >
                <item.icon size={20} className="shrink-0 group-hover:animate-icon-wiggle" />
                {expanded && (
                  <span className="text-[13px] font-medium leading-4 whitespace-nowrap overflow-hidden">
                    {item.label}
                  </span>
                )}
                {!expanded && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--c-hover)] text-[var(--c-text)] text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap border border-[var(--c-border)]">
                    {item.label}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom: User + Logout + Collapse */}
        <div className="p-2 border-t border-[var(--c-border)] flex flex-col gap-1">
          {/* User mini profile */}
          <div
            className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-[var(--c-hover)] transition-colors group relative"
            onClick={() => setProfileOpen(true)}
            title="Ver perfil"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-7 h-7 rounded-full shrink-0 group-hover:animate-icon-pulse-ring"
            />
            {expanded && (
              <div className="overflow-hidden">
                <div className="text-[var(--c-text)] text-[11px] font-medium leading-4 truncate">
                  {currentUser.name}
                </div>
                <div className="text-[var(--c-muted-2)] text-[10px] leading-3 truncate">
                  {roleDisplayNames[currentUser.role]}
                </div>
              </div>
            )}
            {!expanded && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--c-hover)] text-[var(--c-text)] text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap border border-[var(--c-border)]">
                Ver perfil
              </div>
            )}
          </div>

          {/* Logout button */}
          <button
            onClick={() => void logout()}
            title="Sair"
            className="flex items-center justify-center gap-2 py-2 rounded-md text-[var(--c-muted-2)] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors group relative w-full"
          >
            <LogOut size={16} className="shrink-0 group-hover:animate-icon-shake" />
            {expanded && (
              <span className="text-[11px] font-medium">Sair</span>
            )}
            {!expanded && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--c-hover)] text-[var(--c-text)] text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap border border-[var(--c-border)]">
                Sair
              </div>
            )}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={toggle}
            className="flex items-center justify-center w-full h-8 rounded-md text-[var(--c-muted-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] transition-colors group"
          >
            {expanded
              ? <ChevronLeft size={16} className="group-hover:animate-icon-bounce" />
              : <ChevronRight size={16} className="group-hover:animate-icon-bounce" />
            }
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
            className="relative bg-[var(--c-surface)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-[360px] p-6 animate-in zoom-in-95 fade-in duration-350"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseProfile}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md text-[var(--c-muted-2)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] transition-colors"
            >
              <X size={18} />
            </button>

            {/* User info */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-4 group">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-20 h-20 rounded-full object-cover"
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarLoading}
                  className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {avatarLoading
                    ? <Loader2 size={20} className="text-white animate-spin" />
                    : <Camera size={20} className="text-white" />}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleAvatarChange(e)}
                />
              </div>
              {avatarError && (
                <p className="text-[#EF4444] text-[11px] mb-2 text-center">{avatarError}</p>
              )}
              <h2 className="text-[20px] font-semibold text-[var(--c-text)] tracking-[-0.6px]">
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
              <span className="text-[13px] text-[var(--c-muted)] mt-1">
                {departmentDisplayNames[currentUser.department]}
              </span>
              <span className="text-[12px] text-[var(--c-muted-2)] mt-2">
                {currentUser.email}
              </span>
            </div>


            {/* Password change */}
            <div className="border-t border-[var(--c-border)] pt-5 space-y-3">
              <p className="text-[11px] font-medium tracking-[0.5px] text-[var(--c-muted)] uppercase">
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
                  className="w-full h-10 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-md px-3 pr-10 text-[13px] text-[var(--c-text)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)]"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--c-muted-2)] hover:text-[var(--c-text)] transition-colors"
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
                  className="w-full h-10 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-md px-3 pr-10 text-[13px] text-[var(--c-text)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-border-2)]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(!showConfirmPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--c-muted-2)] hover:text-[var(--c-text)] transition-colors"
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
