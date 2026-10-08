import { Routes, Route, Navigate } from "react-router-dom";
import { Login } from "@/pages/Login";
import { Quadro } from "@/pages/Quadro";
import { Tarefas } from "@/pages/Tarefas";
import { Equipe } from "@/pages/Equipe";
import { Relatorios } from "@/pages/Relatorios";
import { Configuracoes } from "@/pages/Configuracoes";
import { Clientes } from "@/pages/Clientes";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { useEffect } from "react";
import { KanbanScope } from "@/components/KanbanScope";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const authLoading = useStore((s) => s.authLoading);

  if (authLoading) return null;

  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}

function RoleGuard({
  children,
  permission,
}: {
  children: React.ReactNode;
  permission: "canViewEquipe" | "canViewRelatorios" | "canManageKanbans" | "canViewClientes";
}) {
  const perms = usePermissions();
  return perms[permission] ? <>{children}</> : <Navigate to="/quadro" replace />;
}

function App() {
  const initAuth = useStore((s) => s.initAuth);
  const theme = useStore((s) => s.theme);
  useInactivityLogout();

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
  }, [theme]);

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route element={<PrivateRoute><KanbanScope /></PrivateRoute>}>
      <Route
        path="/quadro/:kanbanSlug?"
        element={
          <PrivateRoute>
            <Quadro />
          </PrivateRoute>
        }
      />
      <Route
        path="/tarefas/:kanbanSlug?"
        element={
          <PrivateRoute>
            <Tarefas />
          </PrivateRoute>
        }
      />
      <Route
        path="/equipe/:kanbanSlug?"
        element={
          <PrivateRoute>
            <RoleGuard permission="canViewEquipe">
              <Equipe />
            </RoleGuard>
          </PrivateRoute>
        }
      />
      <Route
        path="/relatorios/:kanbanSlug?"
        element={
          <PrivateRoute>
            <RoleGuard permission="canViewRelatorios">
              <Relatorios />
            </RoleGuard>
          </PrivateRoute>
        }
      />
      <Route
        path="/configuracoes/:kanbanSlug?"
        element={
          <PrivateRoute>
            <RoleGuard permission="canManageKanbans">
              <Configuracoes />
            </RoleGuard>
          </PrivateRoute>
        }
      />
      <Route
        path="/clientes/:kanbanSlug?"
        element={
          <PrivateRoute>
            <RoleGuard permission="canViewClientes">
              <Clientes />
            </RoleGuard>
          </PrivateRoute>
        }
      />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
