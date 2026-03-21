import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, Crown, Dumbbell, Loader2, Lock, Sparkles, User, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  generateDietPlan,
  generateWorkoutPlan,
  normalizePlanForStorage,
  normalizePremiumPlan,
  type FitnessProfile,
  type PremiumPlan,
} from "@/lib/gemini";
import { startCheckout } from "@/lib/checkout";

type PlanType = "dieta" | "rutina";

type PlanRow = {
  content: unknown;
  created_at: string;
  id: string;
  plan_type: PlanType;
  updated_at: string;
};

type StoredPlan = {
  content: PremiumPlan;
  created_at: string;
  id: string;
  plan_type: PlanType;
  updated_at: string;
};

type SubscriptionRow = {
  current_period_end: string | null;
  status: string;
};

const previewSections = 2;

function isActiveSubscription(subscription: SubscriptionRow | null) {
  if (!subscription) return false;
  if (!["active", "trialing"].includes(subscription.status)) return false;
  if (!subscription.current_period_end) return true;
  return new Date(subscription.current_period_end) > new Date();
}

function pickLatestPlan(rows: PlanRow[], planType: PlanType): StoredPlan | null {
  const compatibleRows = rows
    .filter((row) => row.plan_type === planType)
    .map((row) => ({
      normalized: normalizePremiumPlan(row.content, planType),
      row,
    }))
    .filter((item): item is { normalized: PremiumPlan; row: PlanRow } => Boolean(item.normalized))
    .sort((a, b) => new Date(b.row.updated_at ?? b.row.created_at).getTime() - new Date(a.row.updated_at ?? a.row.created_at).getTime());

  const latest = compatibleRows[0];

  if (!latest) {
    return null;
  }

  return {
    content: latest.normalized,
    created_at: latest.row.created_at,
    id: latest.row.id,
    plan_type: latest.row.plan_type,
    updated_at: latest.row.updated_at,
  };
}

function needsMigration(row: PlanRow) {
  const normalized = normalizePremiumPlan(row.content, row.plan_type);
  if (!normalized) return null;
  return JSON.stringify(row.content) === JSON.stringify(normalized) ? null : normalized;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { loading: authLoading, session, signOut, user } = useAuth();
  const [profile, setProfile] = useState<FitnessProfile | null>(null);
  const [dietPlan, setDietPlan] = useState<StoredPlan | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<StoredPlan | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [activeTab, setActiveTab] = useState<PlanType>("dieta");
  const [loadingData, setLoadingData] = useState(true);
  const [generating, setGenerating] = useState<PlanType | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const hasPremiumAccess = useMemo(() => isActiveSubscription(subscription), [subscription]);
  const activePlan = activeTab === "dieta" ? dietPlan : workoutPlan;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    const loadDashboard = async () => {
      setLoadingData(true);

      const [profileResult, plansResult, subscriptionResult] = await Promise.all([
        supabase
          .from("fitness_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("generated_plans")
          .select("id, content, created_at, updated_at, plan_type")
          .eq("user_id", user.id),
        supabase
          .from("subscriptions")
          .select("status, current_period_end")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (profileResult.error) {
        console.error("Error cargando fitness_profiles", profileResult.error);
      }
      if (plansResult.error) {
        console.error("Error cargando generated_plans", plansResult.error);
      }
      if (subscriptionResult.error) {
        console.error("Error cargando subscriptions", subscriptionResult.error);
      }

      setProfile((profileResult.data as FitnessProfile | null) ?? null);
      setSubscription((subscriptionResult.data as SubscriptionRow | null) ?? null);

      const planRows = (plansResult.data ?? []) as PlanRow[];
      setDietPlan(pickLatestPlan(planRows, "dieta"));
      setWorkoutPlan(pickLatestPlan(planRows, "rutina"));
      setLoadingData(false);

      const rowsToMigrate = planRows
        .map((row) => ({ normalized: needsMigration(row), row }))
        .filter((item): item is { normalized: PremiumPlan; row: PlanRow } => Boolean(item.normalized));

      if (rowsToMigrate.length) {
        void Promise.all(
          rowsToMigrate.map(({ normalized, row }) =>
            supabase
              .from("generated_plans")
              .update({ content: normalized })
              .eq("id", row.id),
          ),
        ).catch((error) => {
          console.error("No se pudieron migrar planes legacy al formato actual", error);
        });
      }
    };

    void loadDashboard();
  }, [authLoading, navigate, user]);

  const handleGenerate = async (planType: PlanType) => {
    if (!user) return;
    if (!profile) {
      toast({
        title: "Completa tu onboarding primero",
        description: "Necesitamos tus datos para generar el plan.",
        variant: "destructive",
      });
      navigate("/formulario");
      return;
    }

    setGenerating(planType);

    try {
      const generated = planType === "dieta"
        ? await generateDietPlan(profile)
        : await generateWorkoutPlan(profile);

      const content = normalizePlanForStorage(generated, planType);

      const payload = {
        user_id: user.id,
        plan_type: planType,
        content,
      };

      const { data, error } = await supabase
        .from("generated_plans")
        .upsert(payload, { onConflict: "user_id,plan_type" })
        .select("id, content, created_at, updated_at, plan_type")
        .single();

      if (error) {
        console.error("Error guardando generated_plans", error, payload);
        throw error;
      }

      const storedPlan: StoredPlan = {
        content,
        created_at: data.created_at,
        id: data.id,
        plan_type: planType,
        updated_at: data.updated_at,
      };

      if (planType === "dieta") {
        setDietPlan(storedPlan);
      } else {
        setWorkoutPlan(storedPlan);
      }

      toast({
        title: planType === "dieta" ? "Plan de alimentacion generado" : "Rutina generada",
        description: hasPremiumAccess
          ? "Tu contenido premium ya esta disponible en el dashboard."
          : "Se actualizo tu vista previa premium. Suscribete para desbloquear el plan completo.",
      });
    } catch (error: any) {
      console.error(`Error generando plan ${planType}`, error);
      toast({
        title: "No se pudo generar el plan",
        description: error.message ?? "Error inesperado",
        variant: "destructive",
      });
    } finally {
      setGenerating(null);
    }
  };

  const handleSubscribe = async () => {
    if (!session?.access_token || !user?.email) {
      toast({
        title: "Debes iniciar sesion",
        description: "No pudimos validar tu sesion para Stripe.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    setCheckoutLoading(true);

    try {
      const url = await startCheckout({
        accessToken: session.access_token,
        email: user.email,
        userId: user.id,
      });

      window.location.href = url;
    } catch (error: any) {
      toast({
        title: "No se pudo iniciar el pago",
        description: error.message ?? "Error inesperado",
        variant: "destructive",
      });
      navigate("/failed");
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (authLoading || loadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const profileSummary = profile
    ? [
        `Peso: ${profile.weight ?? "-"} kg`,
        `Altura: ${profile.height ?? "-"} cm`,
        `Edad: ${profile.age ?? "-"}`,
        `Objetivo: ${profile.goal ?? "-"}`,
      ]
    : [];

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between section-padding">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
            <Dumbbell className="h-6 w-6 text-primary" />
            <span>FIT AI</span>
            <span className="text-primary">SYSTEM</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/formulario">
              <Button variant="ghost" size="sm">
                <User className="mr-1 h-4 w-4" />
                Editar datos
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void signOut();
                navigate("/", { replace: true });
              }}
            >
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto section-padding py-8">
        <div className="mb-6 glass-card rounded-2xl p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold">
                {hasPremiumAccess ? "Dashboard premium" : "Vista previa premium"}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {hasPremiumAccess
                  ? "Tu suscripcion esta activa. Puedes ver el contenido completo del dashboard."
                  : "Estas viendo una version limitada. Activa tu suscripcion mensual para desbloquear dieta y rutina completas."}
              </p>
            </div>
            {!hasPremiumAccess && (
              <Button variant="hero" onClick={() => void handleSubscribe()} disabled={checkoutLoading}>
                {checkoutLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirigiendo...
                  </>
                ) : (
                  <>
                    <Crown className="mr-2 h-4 w-4" />
                    Suscribirme por AR$ 15.000
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {profile ? (
          <div className="mb-8 glass-card rounded-xl p-6">
            <h2 className="mb-3 font-display text-lg font-semibold">Tu perfil fitness</h2>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {profileSummary.map((item) => (
                <div key={item} className="font-medium text-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-8 glass-card rounded-xl p-8 text-center">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
            <h2 className="mb-2 font-display text-xl font-bold">Completa tu onboarding</h2>
            <p className="mb-4 text-sm text-muted-foreground">Necesitamos tu perfil para personalizar los planes.</p>
            <Link to="/formulario">
              <Button>Completar ahora</Button>
            </Link>
          </div>
        )}

        <div className="mb-6 flex gap-2">
          <Button variant={activeTab === "dieta" ? "default" : "secondary"} onClick={() => setActiveTab("dieta")} size="sm">
            <Utensils className="mr-1 h-4 w-4" />
            Plan de dieta
          </Button>
          <Button variant={activeTab === "rutina" ? "default" : "secondary"} onClick={() => setActiveTab("rutina")} size="sm">
            <Calendar className="mr-1 h-4 w-4" />
            Rutina semanal
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">
                {activeTab === "dieta" ? "Tu dieta personalizada" : "Tu rutina personalizada"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {activePlan?.updated_at
                  ? `Ultima actualizacion: ${new Date(activePlan.updated_at).toLocaleString("es-AR")}`
                  : "Todavia no generaste este plan."}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleGenerate(activeTab)}
              disabled={Boolean(generating) || !profile}
            >
              {generating === activeTab ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {activePlan ? "Regenerar" : "Generar"}
                </>
              )}
            </Button>
          </div>

          {!activePlan && (
            <div className="glass-card rounded-xl p-8 text-center">
              <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
              <p className="text-sm text-muted-foreground">
                Genera tu primer plan con Gemini para ver una vista previa premium.
              </p>
            </div>
          )}

          {activePlan && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-display text-2xl font-bold">{activePlan.content.title}</h3>
              <p className="mt-1 text-sm text-primary">{activePlan.content.subtitle}</p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{activePlan.content.intro}</p>

              <div className="mt-6 space-y-4">
                {activePlan.content.sections.map((section, index) => {
                  const locked = !hasPremiumAccess && index >= previewSections;

                  return (
                    <div key={`${section.title}-${index}`} className="rounded-xl border border-border/60 bg-background/20 p-4">
                      <h4 className="font-display text-lg font-semibold">{section.title}</h4>
                      <ul className={`mt-3 space-y-2 text-sm text-muted-foreground ${locked ? "select-none blur-sm" : ""}`}>
                        {section.bullets.map((bullet) => (
                          <li key={bullet}>- {bullet}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              <p className={`mt-6 text-sm leading-relaxed text-muted-foreground ${!hasPremiumAccess ? "select-none blur-sm" : ""}`}>
                {activePlan.content.closing}
              </p>
            </div>
          )}

          {!hasPremiumAccess && activePlan && (
            <div className="glass-card rounded-2xl p-6 text-center">
              <Lock className="mx-auto mb-3 h-8 w-8 text-primary" />
              <h3 className="font-display text-lg font-bold">Desbloquea el dashboard completo</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Activa la suscripcion mensual para ver todas las secciones del plan, regenerar sin limites y acceder a la experiencia premium completa.
              </p>
              <Button className="mt-4" variant="hero" onClick={() => void handleSubscribe()} disabled={checkoutLoading}>
                {checkoutLoading ? "Redirigiendo..." : "Suscribirme ahora"}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
