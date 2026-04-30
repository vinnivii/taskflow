import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Lock,
  ArrowRight,
  Shield,
  ChevronLeft,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { supabase } from "@/utils/supabase";
import { generateAvatar } from "@/utils/avatar";
import logoImg from "@/assets/logo.png";
import type { User } from "@/types";

/* ─── Partículas de fundo ─────────────────────────────────── */
const PARTICLES = [
  { top: "8%",  left: "6%",  size: 3,   delay: "0s",    dur: "3.2s" },
  { top: "18%", left: "52%", size: 2,   delay: "0.8s",  dur: "4.1s" },
  { top: "31%", left: "80%", size: 2.5, delay: "1.4s",  dur: "3.7s" },
  { top: "47%", left: "4%",  size: 2,   delay: "0.3s",  dur: "5.0s" },
  { top: "58%", left: "68%", size: 3,   delay: "1.9s",  dur: "3.4s" },
  { top: "72%", left: "22%", size: 2,   delay: "0.6s",  dur: "4.6s" },
  { top: "83%", left: "58%", size: 2.5, delay: "2.1s",  dur: "3.9s" },
  { top: "91%", left: "38%", size: 2,   delay: "1.1s",  dur: "4.3s" },
  { top: "14%", left: "35%", size: 1.5, delay: "2.6s",  dur: "5.2s" },
  { top: "64%", left: "88%", size: 2,   delay: "0.4s",  dur: "3.6s" },
  { top: "39%", left: "44%", size: 1.5, delay: "1.7s",  dur: "4.8s" },
  { top: "76%", left: "75%", size: 2,   delay: "2.9s",  dur: "3.3s" },
];

/* ─── Mini dashboard mockup ──────────────────────────────── */
function AppMockup() {
  const tasks = [
    { label: "Planejamento do projeto",   color: "#F2C94C", tag: "Comercial" },
    { label: "Reunião com equipe",        color: "#3B82F6", tag: "Suporte"   },
    { label: "Desenvolvimento da feature",color: "#A855F7", tag: "Tecnico"   },
    { label: "Testes e validação",        color: "#22C55E", tag: "Suporte"   },
    { label: "Entrega ao cliente",        color: "#EF4444", tag: "Comercial" },
  ];

  return (
    <div className="relative w-full max-w-[540px]" style={{ perspective: "1400px" }}>
      {/* Glow orb animado */}
      <div
        className="absolute animate-glow-pulse pointer-events-none"
        style={{
          left: "50%", top: "50%",
          width: 480, height: 320,
          background:
            "radial-gradient(ellipse at center, rgba(242,201,76,0.28) 0%, rgba(249,115,22,0.14) 42%, transparent 68%)",
          filter: "blur(28px)",
          borderRadius: "50%",
        }}
      />

      {/* Reflexo inferior */}
      <div
        className="absolute bottom-[-40px] left-[10%] right-[10%] h-12 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(242,201,76,0.18) 0%, transparent 70%)",
          filter: "blur(16px)",
        }}
      />

      {/* Janela — com animação float */}
      <div
        className="animate-float relative bg-[#111111] rounded-2xl border border-white/[0.06] overflow-hidden"
        style={{
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px rgba(0,0,0,0.8), 0 0 60px rgba(242,201,76,0.06)",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Barra de título */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]"
          style={{ background: "rgba(0,0,0,0.3)" }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#F2C94C]/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]/80" />
          </div>
          <div className="flex-1 mx-4">
            <div
              className="mx-auto w-28 h-3.5 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className="text-[5px] text-white/20 font-mono">taskflow.softcom.app</span>
            </div>
          </div>
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-4 h-2.5 rounded bg-white/[0.04]" />
            ))}
          </div>
        </div>

        <div className="flex h-[272px]">
          {/* Sidebar */}
          <div
            className="w-12 border-r border-white/[0.04] flex flex-col items-center py-3 gap-3"
            style={{ background: "rgba(0,0,0,0.25)" }}
          >
            <div className="w-6 h-6 bg-[#F2C94C] rounded-lg flex items-center justify-center shadow-[0_0_10px_rgba(242,201,76,0.5)]">
              <span className="text-[#0A0A0A] font-black text-[9px]">S</span>
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-5 h-4 rounded"
                style={{
                  background: i === 0
                    ? "rgba(242,201,76,0.18)"
                    : "rgba(255,255,255,0.04)",
                  borderLeft: i === 0 ? "2px solid #F2C94C" : "2px solid transparent",
                }}
              />
            ))}
          </div>

          {/* Conteúdo principal */}
          <div className="flex-1 p-3.5 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <div className="text-[9px] font-bold text-white/90 leading-tight">Dashboard</div>
                <div className="text-[6px] text-white/30 mt-0.5">Minhas Tarefas</div>
              </div>
              <div className="flex gap-1">
                {["#F2C94C26","#3B82F626","#A855F726"].map((bg, i) => (
                  <div key={i} className="w-4 h-3 rounded" style={{ background: bg }} />
                ))}
              </div>
            </div>

            {/* Tasks */}
            <div className="space-y-1.5">
              {tasks.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2 py-1 rounded-md"
                  style={{ background: "rgba(255,255,255,0.025)" }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: t.color,
                      boxShadow: `0 0 4px ${t.color}88`,
                    }}
                  />
                  <span className="text-[7px] text-white/70 flex-1 truncate">{t.label}</span>
                  <span
                    className="text-[5px] px-1.5 py-0.5 rounded font-semibold shrink-0"
                    style={{ background: t.color + "22", color: t.color }}
                  >
                    {t.tag}
                  </span>
                  <div className="w-10 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${[75, 45, 90, 30, 60][i]}%`,
                        background: t.color,
                        opacity: 0.7,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Painel direito — calendário + progresso */}
          <div className="w-[116px] border-l border-white/[0.04] p-2.5 flex flex-col gap-3">
            {/* Calendário */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[6px] text-white/50 font-semibold">Maio 2024</span>
                <span className="text-[7px] text-white/25">›</span>
              </div>
              <div className="grid grid-cols-7 gap-px">
                {["D","S","T","Q","Q","S","S"].map((d, i) => (
                  <div key={i} className="text-[4px] text-white/25 text-center py-0.5">{d}</div>
                ))}
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <div
                    key={d}
                    className="text-[4.5px] text-center leading-[10px] rounded-[2px] font-medium"
                    style={{
                      background: d === 14 ? "#F2C94C" : d === 7 || d === 21 ? "rgba(242,201,76,0.12)" : "transparent",
                      color: d === 14 ? "#0A0A0A" : d === 7 || d === 21 ? "#F2C94C" : "rgba(255,255,255,0.3)",
                      fontWeight: d === 14 ? 800 : 400,
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>
            </div>

            {/* Card progresso */}
            <div
              className="rounded-xl p-2.5 mt-auto"
              style={{
                background: "linear-gradient(135deg, rgba(242,201,76,0.08) 0%, rgba(249,115,22,0.05) 100%)",
                border: "1px solid rgba(242,201,76,0.12)",
              }}
            >
              <div className="text-[5.5px] text-white/40 mb-1 font-medium">Progresso do projeto</div>
              <div
                className="text-[15px] font-black leading-none mb-1.5"
                style={{
                  background: "linear-gradient(90deg, #F2C94C, #F97316)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                75%
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: "75%",
                    background: "linear-gradient(90deg, #F2C94C 0%, #F97316 100%)",
                    boxShadow: "0 0 6px rgba(242,201,76,0.5)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Login page ──────────────────────────────────────────── */
export function Login() {
  const navigate  = useNavigate();
  const login     = useStore((s) => s.login);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const authLoading     = useStore((s) => s.authLoading);

  const [email,      setEmail]      = useState(() => localStorage.getItem("tf_remember_email") ?? "");
  const [password,   setPassword]   = useState("");
  const [showPw,     setShowPw]     = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem("tf_remember_email"));
  const [isLoading,  setIsLoading]  = useState(false);
  const [error,      setError]      = useState("");

  const [forgotMode,   setForgotMode]   = useState(false);
  const [resetEmail,   setResetEmail]   = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent,    setResetSent]    = useState(false);
  const [resetError,   setResetError]   = useState("");

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate("/quadro");
  }, [isAuthenticated, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) { setError("Informe e-mail e senha."); return; }
    setIsLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError || !data.user) { setError("E-mail ou senha incorretos."); setIsLoading(false); return; }

    const { data: profile, error: profileError } = await supabase
      .from("users").select("*").eq("id", data.user.id).single();
    if (profileError || !profile) {
      setError("Usuário não encontrado no sistema.");
      await supabase.auth.signOut();
      setIsLoading(false);
      return;
    }

    rememberMe
      ? localStorage.setItem("tf_remember_email", email.trim())
      : localStorage.removeItem("tf_remember_email");

    login({
      id: profile.id, name: profile.name, email: profile.email,
      avatar: profile.avatar || generateAvatar(profile.name), role: profile.role,
      department: profile.department, createdAt: new Date(profile.created_at),
    } as User);
    navigate("/quadro");
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    if (!resetEmail.trim()) { setResetError("Informe seu e-mail."); return; }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim());
    setResetLoading(false);
    if (error) { setResetError(error.message); return; }
    setResetSent(true);
  };

  return (
    <div className="min-h-screen w-full flex bg-[#080808] overflow-hidden">

      {/* ══ LADO ESQUERDO ════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden">

        {/* Partículas */}
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="absolute rounded-full animate-particle-blink pointer-events-none"
            style={{
              top: p.top, left: p.left,
              width:  p.size,
              height: p.size,
              background: "#F2C94C",
              boxShadow: `0 0 ${p.size * 5}px ${p.size * 2}px rgba(242,201,76,0.45)`,
              animationDelay: p.delay,
              animationDuration: p.dur,
            }}
          />
        ))}

        {/* Gradiente de fundo sutil */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 30% 60%, rgba(242,201,76,0.04) 0%, transparent 55%), " +
              "radial-gradient(ellipse at 80% 20%, rgba(249,115,22,0.03) 0%, transparent 45%)",
          }}
        />

        {/* Logo — fade-up delay 0 */}
        <div
          className="absolute top-10 left-12 flex items-center gap-2.5 animate-fade-up z-10"
          style={{ animationDelay: "0ms" }}
        >
          <div className="w-8 h-8 bg-[#F2C94C] rounded-lg flex items-center justify-center shadow-[0_0_16px_rgba(242,201,76,0.4)]">
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M2 7L5.5 10.5L12 3.5" stroke="#0A0A0A" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[#F0F0F0] font-bold text-[17px] tracking-[-0.5px]">
            Task<span className="text-[#F2C94C]">Flow</span>
          </span>
        </div>

        {/* Conteúdo central */}
        <div className="flex flex-col justify-center flex-1 px-16 pb-12 pt-28">

          {/* Badge — fade-up delay 100ms */}
          <div
            className="inline-flex items-center self-start gap-2 px-3.5 py-1.5 rounded-full mb-8 animate-fade-up"
            style={{
              animationDelay: "100ms",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#F2C94C]"
              style={{ boxShadow: "0 0 6px #F2C94C" }}
            />
            <span className="text-[#F2C94C] text-[12px] font-semibold tracking-[0.3px]">
              Organize. Planeje. Execute.
            </span>
          </div>

          {/* Headline — fade-up delay 200ms */}
          <div
            className="animate-fade-up"
            style={{ animationDelay: "200ms" }}
          >
            <h1 className="text-[48px] font-black leading-[1.07] tracking-[-2.5px] text-[#F0F0F0] mb-2">
              Seu time mais
              <br />organizado,
            </h1>
            <h1
              className="text-[48px] font-black leading-[1.07] tracking-[-2.5px] mb-5 animate-shine"
              style={{
                backgroundImage: "linear-gradient(90deg, #F2C94C 20%, #F97316 50%, #F2C94C 80%)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              mais produtivo.
            </h1>
          </div>

          {/* Subtítulo — fade-up delay 300ms */}
          <p
            className="text-[#5A5A5A] text-[15px] leading-[1.7] max-w-[360px] mb-12 animate-fade-up"
            style={{ animationDelay: "300ms" }}
          >
            Gerencie tarefas, acompanhe prazos
            <br />e entregue resultados com eficiência.
          </p>

          {/* Mockup — fade-up delay 420ms */}
          <div
            className="animate-fade-up"
            style={{ animationDelay: "420ms" }}
          >
            <AppMockup />
          </div>
        </div>

        {/* Dots — fade-in delay 600ms */}
        <div
          className="absolute bottom-10 left-16 flex items-center gap-2 animate-fade-in"
          style={{ animationDelay: "600ms" }}
        >
          <span className="w-7 h-2 bg-[#F2C94C] rounded-full shadow-[0_0_8px_rgba(242,201,76,0.6)]" />
          <span className="w-2 h-2 bg-white/10 rounded-full" />
          <span className="w-2 h-2 bg-white/10 rounded-full" />
        </div>

        {/* Linha divisória com fade */}
        <div
          className="absolute right-0 top-0 bottom-0 w-px"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.06) 80%, transparent 100%)",
          }}
        />
      </div>

      {/* ══ LADO DIREITO ─ card de login ═════════════════════ */}
      <div className="w-full lg:w-[500px] shrink-0 flex flex-col bg-[#0E0E0E]">
        <div className="flex-1 flex flex-col justify-center px-10 py-12">
          {!forgotMode ? (
            <>
              {/* Ícone + título */}
              <div className="flex flex-col items-center mb-8">
                <img
                  src={logoImg}
                  alt="Logo"
                  className="w-16 h-16 mb-4"
                />
                <h1 className="text-[26px] font-bold text-[#F0F0F0] tracking-[-0.8px]">
                  {import.meta.env.VITE_APP_NAME_EMPRESA}
                </h1>
                <p className="text-[#3A3A3A] text-[13px] mt-0.5">
                  {import.meta.env.VITE_APP_NAME}
                </p>
              </div>

              {/* Saudação */}
              <div className="mb-6">
                <h2 className="text-[20px] font-semibold text-[#F0F0F0] tracking-[-0.5px]">
                  Seja Bem-vindo! 👋
                </h2>
                <p className="text-[#4A4A4A] text-[13px] mt-1">
                  Faça login para continuar gerenciando suas tarefas.
                </p>
              </div>

              {/* Formulário */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-[#EF4444]/08 border border-[#EF4444]/20 rounded-xl px-4 py-2.5">
                    <p className="text-[#EF4444] text-[13px]">{error}</p>
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="text-[10px] font-bold tracking-[1px] text-[#5A5A5A] uppercase mb-2 block">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#3A3A3A]" />
                    <input
                      type="email" value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      placeholder="seu@email.com"
                      autoComplete="email"
                      className="w-full h-12 bg-[#161616] border border-[#252525] rounded-xl pl-10 pr-4 text-[14px] text-[#F0F0F0] placeholder:text-[#2A2A2A] outline-none focus:border-[#F2C94C]/35 focus:shadow-[0_0_0_3px_rgba(242,201,76,0.07)] transition-all"
                    />
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label className="text-[10px] font-bold tracking-[1px] text-[#5A5A5A] uppercase mb-2 block">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#3A3A3A]" />
                    <input
                      type={showPw ? "text" : "password"} value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full h-12 bg-[#161616] border border-[#252525] rounded-xl pl-10 pr-12 text-[14px] text-[#F0F0F0] placeholder:text-[#2A2A2A] outline-none focus:border-[#F2C94C]/35 focus:shadow-[0_0_0_3px_rgba(242,201,76,0.07)] transition-all"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#3A3A3A] hover:text-[#F0F0F0] transition-colors">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Lembrar + esqueci */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setRememberMe(!rememberMe)}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${rememberMe ? "bg-[#F2C94C] border-[#F2C94C]" : "border-[#303030] bg-transparent"}`}>
                      {rememberMe && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#0A0A0A" strokeWidth="1.5"
                            strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[13px] text-[#5A5A5A]">Lembrar de mim</span>
                  </label>
                  <button type="button"
                    onClick={() => { setForgotMode(true); setResetEmail(email); }}
                    className="text-[13px] text-[#F2C94C] hover:text-[#F5D76A] transition-colors">
                    Esqueci minha senha
                  </button>
                </div>

                {/* Submit */}
                <button
                  type="submit" disabled={isLoading}
                  className="w-full h-12 rounded-xl text-[14px] font-bold tracking-[-0.2px] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
                  style={{
                    background: "linear-gradient(135deg, #F2C94C 0%, #F5A623 100%)",
                    color: "#0A0A0A",
                    boxShadow: "0 4px 20px rgba(242,201,76,0.28), 0 1px 0 rgba(255,255,255,0.15) inset",
                  }}
                  onMouseEnter={(e) => { if (!isLoading) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : (<>Entrar <ArrowRight size={16} /></>)}
                </button>
              </form>
            </>
          ) : (
            /* Recuperar senha */
            <>
              <button onClick={() => { setForgotMode(false); setResetSent(false); setResetError(""); }}
                className="flex items-center gap-1 text-[#4A4A4A] hover:text-[#F0F0F0] text-[13px] mb-8 transition-colors">
                <ChevronLeft size={16} /> Voltar ao login
              </button>
              <div className="mb-8">
                <h2 className="text-[22px] font-bold text-[#F0F0F0] tracking-[-0.6px]">Recuperar senha</h2>
                <p className="text-[#4A4A4A] text-[13px] mt-1.5 leading-[1.6]">
                  Informe seu e-mail e enviaremos um link para criar uma nova senha.
                </p>
              </div>
              {!resetSent ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  {resetError && (
                    <div className="bg-[#EF4444]/08 border border-[#EF4444]/20 rounded-xl px-4 py-2.5">
                      <p className="text-[#EF4444] text-[13px]">{resetError}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-bold tracking-[1px] text-[#5A5A5A] uppercase mb-2 block">E-mail</label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#3A3A3A]" />
                      <input type="email" value={resetEmail}
                        onChange={(e) => { setResetEmail(e.target.value); setResetError(""); }}
                        placeholder="seu@email.com" autoComplete="email"
                        className="w-full h-12 bg-[#161616] border border-[#252525] rounded-xl pl-10 pr-4 text-[14px] text-[#F0F0F0] placeholder:text-[#2A2A2A] outline-none focus:border-[#F2C94C]/35 focus:shadow-[0_0_0_3px_rgba(242,201,76,0.07)] transition-all"
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={resetLoading}
                    className="w-full h-12 rounded-xl text-[14px] font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
                    style={{
                      background: "linear-gradient(135deg, #F2C94C 0%, #F5A623 100%)",
                      color: "#0A0A0A",
                      boxShadow: "0 4px 20px rgba(242,201,76,0.28)",
                    }}>
                    {resetLoading ? <Loader2 size={18} className="animate-spin" /> : "Enviar link de recuperação"}
                  </button>
                </form>
              ) : (
                <div className="bg-[#22C55E]/08 border border-[#22C55E]/20 rounded-xl px-5 py-4">
                  <p className="text-[#22C55E] text-[14px] font-semibold mb-1">E-mail enviado!</p>
                  <p className="text-[#22C55E]/60 text-[13px]">
                    Verifique <span className="font-semibold text-[#22C55E]/80">{resetEmail}</span> e siga as instruções.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-10 py-5 border-t border-[#161616] flex flex-col items-center gap-1">
          <p className="text-[#C4C4C4] text-[11px] text-center">
            © {new Date().getFullYear()} {import.meta.env.VITE_APP_NAME_EMPRESA} — Todos os direitos reservados.
          </p>
          <p className="text-[#C4C4C4] text-[11px]">v{import.meta.env.VITE_APP_VERSION}</p>
        </div>
      </div>
    </div>
  );
}
