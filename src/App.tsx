import { Routes, Route, Navigate } from "react-router-dom";
import { Login } from "@/pages/Login";
import { Quadro } from "@/pages/Quadro";
import { Tarefas } from "@/pages/Tarefas";
import { Equipe } from "@/pages/Equipe";
import { Relatorios } from "@/pages/Relatorios";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";
import { useEffect } from "react";

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
  permission: "canViewEquipe" | "canViewRelatorios";
}) {
  const perms = usePermissions();
  return perms[permission] ? <>{children}</> : <Navigate to="/quadro" replace />;
}

function App() {
  const initAuth = useStore((s) => s.initAuth);

  useEffect(() => {
    void initAuth();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/quadro"
        element={
          <PrivateRoute>
            <Quadro />
          </PrivateRoute>
        }
      />
      <Route
        path="/tarefas"
        element={
          <PrivateRoute>
            <Tarefas />
          </PrivateRoute>
        }
      />
      <Route
        path="/equipe"
        element={
          <PrivateRoute>
            <RoleGuard permission="canViewEquipe">
              <Equipe />
            </RoleGuard>
          </PrivateRoute>
        }
      />
      <Route
        path="/relatorios"
        element={
          <PrivateRoute>
            <RoleGuard permission="canViewRelatorios">
              <Relatorios />
            </RoleGuard>
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
