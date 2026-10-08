import { useEffect } from "react";
import { Link, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { useStore } from "@/store/useStore";
import { usePermissions } from "@/hooks/usePermissions";
import { AppLayout } from "./AppLayout";

export function KanbanScope() {
  const { kanbanSlug } = useParams();
  const location = useLocation();
  const kanbans = useStore((state) => state.kanbans);
  const loaded = useStore((state) => state.kanbansLoaded);
  const error = useStore((state) => state.kanbansError);
  const activeId = useStore((state) => state.activeKanbanId);
  const loading = useStore((state) => state.scopeLoading);
  const scopeError = useStore((state) => state.scopeError);
  const userId = useStore((state) => state.currentUser?.id);
  const setActiveKanban = useStore((state) => state.setActiveKanban);
  const fetchKanbans = useStore((state) => state.fetchKanbans);
  const permissions = usePermissions();
  const rememberedId = userId ? localStorage.getItem(`tf_kanban_${userId}`) : null;
  const fallback = kanbans.find((kanban) => kanban.id === activeId)
    ?? kanbans.find((kanban) => kanban.id === rememberedId) ?? kanbans[0];
  const requested = kanbans.find((kanban) => kanban.slug === kanbanSlug);
  const target = requested ?? fallback;
  const targetId = target?.id ?? null;
  const section = location.pathname.split("/")[1];

  useEffect(() => {
    if (loaded && (!error || kanbans.length)) void setActiveKanban(targetId);
  }, [loaded, error, kanbans.length, targetId, setActiveKanban]);

  if (!loaded) return <AppLayout title="Kanbans"><p role="status">Carregando Kanbans…</p></AppLayout>;
  if (error && !kanbans.length) return (
    <AppLayout title="Kanbans">
      <p role="alert" className="text-red-400">Não foi possível carregar os Kanbans: {error}</p>
      <button className="mt-4 text-[#F2C94C]" onClick={() => void fetchKanbans()}>Tentar novamente</button>
    </AppLayout>
  );
  if (!target) {
    if (section === "configuracoes" && permissions.canManageKanbans) return <Outlet key="empty" />;
    return (
      <AppLayout title="Kanbans">
        <h2 className="text-lg font-semibold">Nenhum Kanban disponível</h2>
        {permissions.canManageKanbans
          ? <Link className="inline-block mt-4 text-[#F2C94C]" to="/configuracoes">Criar o primeiro Kanban</Link>
          : <p className="mt-2 text-[var(--c-muted)]">Solicite a criação de um Kanban a um supervisor.</p>}
      </AppLayout>
    );
  }
  if (!requested) return <Navigate to={`/${section}/${target.slug}${location.search}`} replace />;
  if (activeId !== target.id || loading) return <AppLayout title={target.name}><p role="status">Carregando este Kanban…</p></AppLayout>;
  if (scopeError) return (
    <AppLayout title={target.name}>
      <p role="alert" className="text-red-400">{scopeError}</p>
      <button className="mt-4 text-[#F2C94C]" onClick={() => void setActiveKanban(target.id)}>Tentar novamente</button>
    </AppLayout>
  );
  return <Outlet key={target.id} />;
}
