import { Outlet, useLocation, Navigate } from "react-router-dom";
import { AppShell } from "@/components/app/app-shell";
import { AppErrorBoundary } from "@/components/app/error-boundary";
import { useAuth } from "@/hooks/use-auth";

export function ShellLayout() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground animate-pulse">Loading workspace…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  return (
    <AppShell>
      <AppErrorBoundary>
        <Outlet />
      </AppErrorBoundary>
    </AppShell>
  );
}

export const Route = { component: ShellLayout };
export default ShellLayout;
