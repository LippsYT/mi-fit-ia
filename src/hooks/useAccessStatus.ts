import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AccessStatus = {
  hasActiveSubscription: boolean;
  loading: boolean;
  onboardingCompleted: boolean;
};

function isActiveSubscription(subscription: { current_period_end?: string | null; status?: string | null } | null) {
  if (!subscription) return false;
  if (!subscription.status || !["active", "trialing"].includes(subscription.status)) return false;
  if (!subscription.current_period_end) return true;
  return new Date(subscription.current_period_end) > new Date();
}

export function useAccessStatus(): AccessStatus {
  const { loading: authLoading, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setHasActiveSubscription(false);
      setOnboardingCompleted(false);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadAccessStatus = async () => {
      setLoading(true);

      const [profileResult, subscriptionResult] = await Promise.all([
        supabase
          .from("fitness_profiles" as any)
          .select("onboarding_completed")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("subscriptions")
          .select("status, current_period_end")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (!mounted) return;

      if (profileResult.error) {
        console.error("Error cargando estado de onboarding", profileResult.error);
      }

      if (subscriptionResult.error) {
        console.error("Error cargando estado de suscripcion", subscriptionResult.error);
      }

      const profile = (profileResult.data as { onboarding_completed?: boolean } | null) ?? null;
      const subscription = (subscriptionResult.data as { current_period_end?: string | null; status?: string | null } | null) ?? null;

      setOnboardingCompleted(Boolean(profile?.onboarding_completed));
      setHasActiveSubscription(isActiveSubscription(subscription));
      setLoading(false);
    };

    void loadAccessStatus();

    return () => {
      mounted = false;
    };
  }, [authLoading, user]);

  return { hasActiveSubscription, loading: authLoading || loading, onboardingCompleted };
}
