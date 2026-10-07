import { Navigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";
import { ToastContainer } from "./Toast";
import { TaskModal } from "./TaskModal";
import { useStore } from "@/store/useStore";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const mobileSidebarOpen = useStore((s) => s.mobileSidebarOpen);
  const closeMobileSidebar = useStore((s) => s.closeMobileSidebar);
  const location = useLocation();
  const isMobile = useIsMobile();

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return (
    <div className="flex h-screen w-screen bg-[var(--c-page)] overflow-hidden">
      <Sidebar />
      {isMobile && mobileSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50" onClick={closeMobileSidebar} />
      )}
      <div className="flex flex-col flex-1 min-w-0">
        <TopHeader title={title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          {children}
        </main>
      </div>
      <TaskModal />
      <ToastContainer />
    </div>
  );
}
