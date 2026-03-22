import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAccessStatus } from "@/hooks/useAccessStatus";

type ProtectedRouteProps = {
  children: React.ReactNode;
  requireOnboarding?: boolean;
  requireSubscription?: boolean;
};

export default function ProtectedRoute({
  children,
  requireOnboarding = false,
  requireSubscription = false,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const accessStatus = useAccessStatus();

  if (loading || accessStatus.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (requireOnboarding && !accessStatus.onboardingCompleted) return <Navigate to="/formulario" replace />;
  if (requireSubscription && !accessStatus.hasActiveSubscription) return <Navigate to="/suscripcion" replace />;

  return <>{children}</>;
}
