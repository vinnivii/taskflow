import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useStore } from "@/store/useStore";

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const borderColors = {
  success: "#22C55E",
  error: "#EF4444",
  warning: "#F2C94C",
  info: "#3B82F6",
};

export function ToastContainer() {
  const toasts = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className="max-w-[360px] bg-[#141414] border-l-4 rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.4)] px-4 py-3 flex items-start gap-3 animate-in slide-in-from-right-4 fade-in duration-250"
            style={{ borderLeftColor: borderColors[toast.type] }}
          >
            <Icon size={18} className="mt-0.5 shrink-0" style={{ color: borderColors[toast.type] }} />
            <div className="flex-1 min-w-0">
              <div className="text-[#F0F0F0] text-[14px] font-semibold">{toast.title}</div>
              <div className="text-[#8A8A8A] text-[13px] mt-0.5">{toast.message}</div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[#5A5A5A] hover:text-[#F0F0F0] transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
