import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { supabase } from "@/utils/supabase";
import { generateAvatar } from "@/utils/avatar";
import logoImg from "@/assets/logo.png";
import type { User } from "@/types";

export function Login() {
  const navigate = useNavigate();
  const login = useStore((s) => s.login);
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/quadro");
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Informe e-mail e senha.");
      setShake(true);
      setTimeout(() => setShake(false), 300);
      return;
    }

    setIsLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError || !data.user) {
      setError("E-mail ou senha incorretos.");
      setShake(true);
      setTimeout(() => setShake(false), 300);
      setIsLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      setError("Usuário não encontrado no sistema.");
      await supabase.auth.signOut();
      setIsLoading(false);
      return;
    }

    const user: User = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      avatar: generateAvatar(profile.name),
      role: profile.role,
      department: profile.department,
      createdAt: new Date(profile.created_at),
    };

    login(user);
    navigate("/quadro");
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
          <img src={logoImg} alt="Logo" className="w-16 h-16" />
          <h1 className="text-[32px] font-bold text-[#F0F0F0] tracking-[-1.5px] leading-[38px] mt-5">
            {import.meta.env.VITE_APP_NAME_EMPRESA}
          </h1>
          <h2 className="text-[18px] font-semibold text-[#8A8A8A] tracking-[-0.5px] leading-6 mt-1">
            TaskFlow
          </h2>
        </div>

        {/* Login Card */}
        <div
          className={`bg-[#141414] rounded-xl p-10 shadow-[0_1px_3px_rgba(0,0,0,0.3)] animate-in fade-in slide-in-from-bottom-5 duration-400 delay-100 ${
            shake ? "animate-shake" : ""
          }`}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error message */}
            {error && (
              <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-md px-3 py-2.5">
                <p className="text-[#EF4444] text-[13px]">{error}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="text-[11px] font-medium tracking-[0.5px] text-[#8A8A8A] uppercase mb-1.5 block">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="seu@email.com"
                autoComplete="email"
                className="w-full h-11 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md px-3 text-[14px] text-[#F0F0F0] placeholder:text-[#5A5A5A] outline-none focus:border-[#3A3A3A] focus:shadow-[0_0_0_3px_rgba(242,201,76,0.15)]"
              />
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
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full h-11 bg-[#1E1E1E] border border-[#2A2A2A] rounded-md px-3 pr-10 text-[14px] text-[#F0F0F0] placeholder:text-[#5A5A5A] outline-none focus:border-[#3A3A3A] focus:shadow-[0_0_0_3px_rgba(242,201,76,0.15)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5A5A] hover:text-[#F0F0F0] transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-[#F2C94C] hover:bg-[#F5D76A] text-[#0A0A0A] text-[13px] font-semibold tracking-[0.3px] rounded-md transition-all hover:-translate-y-px disabled:opacity-80 disabled:cursor-wait flex items-center justify-center"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Entrar"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-[#5A5A5A] text-[11px] tracking-[0.5px]">
              Problemas para acessar? Entre em contato com o Supervisor Geral
            </p>
          </div>
        </div>

        <p className="text-[#5A5A5A] text-[11px] tracking-[0.5px] text-center mt-8">
          {import.meta.env.VITE_APP_NAME_EMPRESA} — {import.meta.env.VITE_APP_NAME} v{import.meta.env.VITE_APP_VERSION}
        </p>
      </div>
    </div>
  );
}
