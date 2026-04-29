import { Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";
import { ToastContainer } from "./Toast";
import { TaskModal } from "./TaskModal";
import { useStore } from "@/store/useStore";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const fetchTasks = useStore((s) => s.fetchTasks);
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchTasks();
  }, [isAuthenticated, fetchTasks]);

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return (
    <div className="flex h-screen w-screen bg-[#0A0A0A] overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopHeader title={title} />
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {children}
        </main>
      </div>
      <TaskModal />
      <ToastContainer />
    </div>
  );
}
