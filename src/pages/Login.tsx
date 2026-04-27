import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { roleDisplayNames, roleDepartmentMap } from "@/types";
import type { UserRole } from "@/types";

const roleOptions: UserRole[] = [
  "supervisor_geral",
  "supervisor_adjunto",
  "tecnico",
  "estagiario",
  "comercial",
  "financeiro",
];

const getDepartmentLabel = (role: UserRole) => {
  const dept = roleDepartmentMap[role];
  return dept === "comercial"
    ? "Comercial"
    : dept === "financeiro"
      ? "Financeiro"
      : "Suporte";
};

export function Login() {
  const navigate = useNavigate();
  const login = useStore((s) => s.login);
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  const [role, setRole] = useState<UserRole | "">("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    role?: string;
    email?: string;
    password?: string;
  }>({});
  const [shake, setShake] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/quadro");
    }
  }, [isAuthenticated, navigate]);

  // Auto-fill on role change
  useEffect(() => {
    if (role) {
      setEmail(`${role.replace(/_/g, "")}@Softcom.demo`);
      setPassword("demo1234");
      setErrors({});
    }
  }, [role]);

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!role) newErrors.role = "Selecione um cargo";
    if (!email.trim()) newErrors.email = "Informe seu e-mail";
    if (!password.trim()) newErrors.password = "Informe sua senha";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      setShake(true);
      setTimeout(() => setShake(false), 300);
      return;
    }

    setIsLoading(true);

    // Simulate network delay
    await new Promise((r) => setTimeout(r, 800));

    if (role) {
      const mockUser = {
        id: `user_${role}`,
        name: roleDisplayNames[role],
        email: email,
        avatar: ``,
        role,
        department: roleDepartmentMap[role],
        createdAt: new Date("2024-01-15"),
      };

      // Generate avatar
      const colors = [
        "#F2C94C",
        "#A855F7",
        "#3B82F6",
        "#22C55E",
        "#EF4444",
        "#F97316",
      ];
      const index = roleOptions.indexOf(role);
      const color = colors[index % colors.length];
      const initials = mockUser.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${color}" opacity="0.9"/><text x="32" y="38" text-anchor="middle" fill="#0A0A0A" font-family="Inter,sans-serif" font-weight="700" font-size="22">${initials}</text></svg>`;
      mockUser.avatar = `data:image/svg+xml;base64,${btoa(svg)}`;

      login(mockUser);
      navigate("/quadro");
    }

    setIsLoading(false);
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-[#0A0A0A]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(30deg, transparent, transparent 39px, rgba(255,255,255,0.03) 39px, rgba(255,255,255,0.03) 40px)",
      }}
    >
      <div className="w-full max-w-[420px] px-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-400">
          <div className="w-16 h-16 rounded-full bg-[#F2C94C] flex items-center justify-center">
            <span className="text-[#0A0A0A] font-bold text-[28px]">S</span>
          </div>
          <h1 className="text-[32px] font-bold text-[#F0F0F0] tracking-[-1.5px] leading-[38px] mt-5">
            Softcom
          </h1>
          <h2 className="text-[18px] font-semibold text-[#8A8A8A] tracking-[-0.5px] leading-6 mt-1">
            TaskFlow
          </h2>
          <p className="text-[13px] text-[#5A5A5A] mt-2">
            Gerenciamento de Tarefas Internas
          </p>
        </div>

        {/* Login Card */}
        <div
          className={`bg-[#141414] rounded-xl p-10 shadow-[0_1px_3px_rgba(0,0,0,0.3)] animate-in fade-in slide-in-from-bottom-5 duration-400 delay-100 ${
            shake ? "animate-shake" : ""
          }`}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role selector */}
            <div>
              <label className="text-[11px] font-medium tracking-[0.5px] text-[#8A8A8A] uppercase mb-1.5 block">
                Seu cargo
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole | "")}
                className={`w-full h-11 bg-[#1E1E1E] border rounded-md px-3 text-[14px] text-[#F0F0F0] outline-none focus:border-[#3A3A3A] focus:shadow-[0_0_0_3px_rgba(242,201,76,0.15)] appearance-none cursor-pointer ${
                  errors.role ? "border-[#EF4444]" : "border-[#2A2A2A]"
                }`}
              >
                <option value="">Selecione seu cargo...</option>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {roleDisplayNames[r]} ({getDepartmentLabel(r)})
                  </option>
                ))}
              </select>
              {errors.role && (
                <p className="text-[#EF4444] text-[11px] mt-1">{errors.role}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="text-[11px] font-medium tracking-[0.5px] text-[#8A8A8A] uppercase mb-1.5 block">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email)
                    setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                placeholder="seu@Softcom.com"
                className={`w-full h-11 bg-[#1E1E1E] border rounded-md px-3 text-[14px] text-[#F0F0F0] placeholder:text-[#5A5A5A] outline-none focus:border-[#3A3A3A] focus:shadow-[0_0_0_3px_rgba(242,201,76,0.15)] ${
                  errors.email ? "border-[#EF4444]" : "border-[#2A2A2A]"
                }`}
              />
              {errors.email && (
                <p className="text-[#EF4444] text-[11px] mt-1">
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="text-[11px] font-medium tracking-[0.5px] text-[#8A8A8A] uppercase mb-1.5 block">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password)
                      setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  placeholder="********"
                  className={`w-full h-11 bg-[#1E1E1E] border rounded-md px-3 pr-10 text-[14px] text-[#F0F0F0] placeholder:text-[#5A5A5A] outline-none focus:border-[#3A3A3A] focus:shadow-[0_0_0_3px_rgba(242,201,76,0.15)] ${
                    errors.password ? "border-[#EF4444]" : "border-[#2A2A2A]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5A5A] hover:text-[#F0F0F0] transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[#EF4444] text-[11px] mt-1">
                  {errors.password}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-[#F2C94C] hover:bg-[#F5D76A] text-[#0A0A0A] text-[13px] font-semibold tracking-[0.3px] rounded-md transition-all hover:-translate-y-px disabled:opacity-80 disabled:cursor-wait flex items-center justify-center"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          {/* Help text */}
          <div className="mt-5 text-center">
            <button
              type="button"
              className="text-[#F2C94C] text-[13px] hover:underline transition-all"
            >
              Esqueceu a senha?
            </button>
            <p className="text-[#5A5A5A] text-[11px] tracking-[0.5px] mt-1">
              Entre em contato com o Supervisor Geral
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[#5A5A5A] text-[11px] tracking-[0.5px] text-center mt-8">
          Softcom ERP Support — TaskFlow v1.0
        </p>
      </div>
    </div>
  );
}
