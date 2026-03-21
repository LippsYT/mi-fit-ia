import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, Crown, Dumbbell, Loader2, Lock, Sparkles, User, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { generateDietPlan, generateWorkoutPlan, type FitnessProfile, type PremiumPlan } from "@/lib/gemini";

type StoredPlan = {
  content: PremiumPlan;
  created_at: string;
  plan_type: "dieta" | "rutina";
};

type SubscriptionRow = {
  current_period_end: string | null;
  status: string;
  stripe_customer_id: string | null;
};

const previewSections = 2;

function isActiveSubscription(subscription: SubscriptionRow | null) {
  if (!subscription) return false;
  if (!["active", "trialing"].includes(subscription.status)) return false;
  if (!subscription.current_period_end) return true;
  return new Date(subscription.current_period_end) > new Date();
}

function normalizePlan(content: any, planType: "dieta" | "rutina"): PremiumPlan {
  if (content?.sections && Array.isArray(content.sections)) {
    return content as PremiumPlan;
  }

  if (planType === "dieta" && Array.isArray(content?.meals)) {
    return {
      closing: `Macros estimados: Proteinas ${content?.macros?.proteinas ?? "-"}, Carbohidratos ${content?.macros?.carbohidratos ?? "-"}, Grasas ${content?.macros?.grasas ?? "-"}.`,
      intro: "Convertimos tu plan guardado anterior a la nueva vista premium.",
      sections: content.meals.map((meal: any) => ({
        title: meal.meal ?? "Comida",
        bullets: [meal.items ?? "", `Calorias estimadas: ${meal.cal ?? "-"}`],
      })),
      subtitle: `Total diario estimado: ${content?.totalCal ?? "-"}`,
      title: "Plan de alimentacion personalizado",
    };
  }

  if (planType === "rutina" && Array.isArray(content?.days)) {
    return {
      closing: "Sigue una progresion gradual y prioriza tecnica, descanso y constancia.",
      intro: "Convertimos tu rutina guardada anterior a la nueva vista premium.",
      sections: content.days.map((day: any) => ({
        title: `${day.day ?? "Dia"} - ${day.focus ?? "Enfoque"}`,
        bullets: [day.exercises ?? ""],
      })),
      subtitle: "Rutina semanal personalizada",
      title: "Plan de entrenamiento premium",
    };
  }

  return {
    closing: "Genera nuevamente tu plan para obtener una version premium completa.",
    intro: "No pudimos interpretar el plan guardado con el formato actual.",
    sections: [],
    subtitle: "Contenido antiguo no compatible",
    title: "Plan pendiente de regeneracion",
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { loading: authLoading, session, signOut, user } = useAuth();
  const [profile, setProfile] = useState<FitnessProfile | null>(null);
  const [dietPlan, setDietPlan] = useState<StoredPlan | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<StoredPlan | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [activeTab, setActiveTab] = useState<"dieta" | "rutina">("dieta");
  const [loadingData, setLoadingData] = useState(true);
  const [generating, setGenerating] = useState<"dieta" | "rutina" | null>(null);
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
          .select("content, created_at, plan_type")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("subscriptions")
          .select("status, current_period_end, stripe_customer_id")
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

      const plans = (plansResult.data ?? []) as StoredPlan[];
      const latestDiet = plans.find((plan) => plan.plan_type === "dieta") ?? null;
      const latestWorkout = plans.find((plan) => plan.plan_type === "rutina") ?? null;
      setDietPlan(latestDiet ? { ...latestDiet, content: normalizePlan(latestDiet.content, "dieta") } : null);
      setWorkoutPlan(latestWorkout ? { ...latestWorkout, content: normalizePlan(latestWorkout.content, "rutina") } : null);
      setSubscription((subscriptionResult.data as SubscriptionRow | null) ?? null);
      setLoadingData(false);
    };

    void loadDashboard();
  }, [authLoading, navigate, user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscribed") === "true") {
      toast({
        title: "Suscripcion activada",
        description: "Tu cuenta premium ya puede desbloquear el dashboard completo.",
      });
      params.delete("subscribed");
      const nextQuery = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
    }
  }, []);

  const handleGenerate = async (planType: "dieta" | "rutina") => {
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
      const content = planType === "dieta"
        ? await generateDietPlan(profile)
        : await generateWorkoutPlan(profile);

      const { error } = await supabase.from("generated_plans").insert({
        user_id: user.id,
        plan_type: planType,
        content,
      });

      if (error) {
        console.error("Error guardando generated_plans", error, { planType, content });
        throw error;
      }

      const storedPlan: StoredPlan = {
        content,
        created_at: new Date().toISOString(),
        plan_type: planType,
      };

      if (planType === "dieta") {
        setDietPlan(storedPlan);
      } else {
        setWorkoutPlan(storedPlan);
      }

      toast({
        title: planType === "dieta" ? "Plan de alimentacion generado" : "Rutina generada",
        description: hasPremiumAccess
          ? "Ya tienes acceso completo al resultado."
          : "Se genero una vista previa premium con CTA de suscripcion.",
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
    if (!session?.access_token || !user) {
      toast({
        title: "Debes iniciar sesion",
        description: "No pudimos validar tu sesion para Stripe.",
        variant: "destructive",
      });
      return;
    }

    setCheckoutLoading(true);

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        console.error("Error create-checkout-session", payload);
        throw new Error(payload.error ?? "No se pudo crear la sesion de checkout");
      }

      window.location.href = payload.url;
    } catch (error: any) {
      toast({
        title: "No se pudo iniciar el pago",
        description: error.message ?? "Error inesperado",
        variant: "destructive",
      });
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
                {activePlan?.created_at
                  ? `Ultima generacion: ${new Date(activePlan.created_at).toLocaleString("es-AR")}`
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
                    <div key={section.title} className="rounded-xl border border-border/60 bg-background/20 p-4">
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
