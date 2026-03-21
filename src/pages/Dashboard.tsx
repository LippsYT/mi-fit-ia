import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, Dumbbell, Loader2, Lock, RefreshCw, Sparkles, User, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface Profile {
  peso: number | null;
  altura: number | null;
  edad: number | null;
  genero: string | null;
  objetivo: string | null;
  actividad: string | null;
  dias: number | null;
  is_subscribed: boolean;
}

interface DietMeal {
  meal: string;
  items: string;
  cal: string;
}

interface DietPlan {
  meals: DietMeal[];
  totalCal: string;
  macros: { proteinas: string; carbohidratos: string; grasas: string };
}

interface RoutineDay {
  day: string;
  focus: string;
  exercises: string;
}

interface RoutinePlan {
  days: RoutineDay[];
}

interface Subscription {
  current_period_end: string | null;
  status: string | null;
  stripe_customer_id: string | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [activeTab, setActiveTab] = useState<"dieta" | "rutina">("dieta");
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [routinePlan, setRoutinePlan] = useState<RoutinePlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [billingLoading, setBillingLoading] = useState<"checkout" | "portal" | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const isSubscribed = Boolean(
    profile?.is_subscribed || (
      subscription &&
      ["active", "trialing"].includes(subscription.status || "") &&
      (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date())
    )
  );

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("peso, altura, edad, genero, objetivo, actividad, dias, is_subscribed")
      .eq("id", user.id)
      .single();

    if (data) {
      setProfile(data as Profile);
    }
  }, [user]);

  const fetchPlans = useCallback(async () => {
    if (!user) return;

    const { data: plans } = await supabase
      .from("generated_plans")
      .select("plan_type, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (plans) {
      const diet = plans.find((plan: any) => plan.plan_type === "dieta");
      const routine = plans.find((plan: any) => plan.plan_type === "rutina");
      if (diet) setDietPlan(diet.content as unknown as DietPlan);
      if (routine) setRoutinePlan(routine.content as unknown as RoutinePlan);
    }
  }, [user]);

  const fetchSubscription = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("subscriptions")
      .select("status, current_period_end, stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setSubscription(data as Subscription);
    } else {
      setSubscription(null);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }

    const load = async () => {
      setLoadingData(true);
      await Promise.all([fetchProfile(), fetchPlans(), fetchSubscription()]);
      setLoadingData(false);
    };

    void load();
  }, [user, authLoading, navigate, fetchProfile, fetchPlans, fetchSubscription]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get("checkout");

    if (!checkoutStatus) return;

    if (checkoutStatus === "success") {
      toast({
        title: "Pago confirmado",
        description: "Tu suscripcion se esta sincronizando con Stripe.",
      });
      void fetchProfile();
      void fetchSubscription();
    }

    if (checkoutStatus === "cancelled") {
      toast({
        title: "Checkout cancelado",
        description: "Puedes volver a intentarlo cuando quieras.",
      });
    }

    params.delete("checkout");
    const nextQuery = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
  }, [fetchProfile, fetchSubscription]);

  const openBillingFlow = async (functionName: "create-checkout-session" | "create-portal-session") => {
    const { data, error } = await supabase.functions.invoke(functionName, { body: {} });
    if (error) throw error;
    if (!data?.url) throw new Error("No se recibio una URL de Stripe");
    window.location.href = data.url;
  };

  const handleSubscribe = async () => {
    setBillingLoading("checkout");
    try {
      await openBillingFlow("create-checkout-session");
    } catch (error: any) {
      toast({
        title: "No se pudo abrir Stripe",
        description: error.message,
        variant: "destructive",
      });
      setBillingLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setBillingLoading("portal");
    try {
      await openBillingFlow("create-portal-session");
    } catch (error: any) {
      toast({
        title: "No se pudo abrir el portal",
        description: error.message,
        variant: "destructive",
      });
      setBillingLoading(null);
    }
  };

  const generatePlan = async (planType: "dieta" | "rutina") => {
    if (!profile?.peso) {
      toast({ title: "Completa tu perfil primero", variant: "destructive" });
      navigate("/formulario");
      return;
    }

    setGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-plan", {
        body: { planType },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (planType === "dieta") {
        setDietPlan(data.plan);
      } else {
        setRoutinePlan(data.plan);
      }

      toast({ title: `Plan de ${planType === "dieta" ? "dieta" : "rutina"} generado` });
    } catch (error: any) {
      toast({
        title: "Error generando plan",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const objectiveLabels: Record<string, string> = {
    "perder-peso": "Perder peso",
    "ganar-musculo": "Ganar musculo",
    "tonificar": "Tonificar",
    "mantener": "Mantener peso",
  };

  if (authLoading || loadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const hasProfile = profile?.peso && profile?.objetivo;

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
            {isSubscribed && (
              <Button variant="ghost" size="sm" onClick={() => void handleManageBilling()} disabled={billingLoading === "portal"}>
                {billingLoading === "portal" ? "Abriendo..." : "Facturacion"}
              </Button>
            )}
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
                navigate("/");
              }}
            >
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto section-padding py-8">
        {hasProfile && (
          <div className="mb-8 glass-card rounded-xl p-6">
            <h2 className="mb-3 font-display text-lg font-semibold">Tu perfil</h2>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><span className="text-muted-foreground">Peso:</span> <span className="font-medium">{profile.peso} kg</span></div>
              <div><span className="text-muted-foreground">Altura:</span> <span className="font-medium">{profile.altura} cm</span></div>
              <div><span className="text-muted-foreground">Edad:</span> <span className="font-medium">{profile.edad} anos</span></div>
              <div><span className="text-muted-foreground">Objetivo:</span> <span className="font-medium">{objectiveLabels[profile.objetivo || ""] || profile.objetivo}</span></div>
            </div>
          </div>
        )}

        {!hasProfile && (
          <div className="mb-8 glass-card rounded-xl p-8 text-center">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
            <h2 className="mb-2 font-display text-xl font-bold">Completa tu perfil</h2>
            <p className="mb-4 text-sm text-muted-foreground">Necesitamos tus datos para generar planes personalizados con IA</p>
            <Link to="/formulario">
              <Button>Completar perfil</Button>
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

        <div className="relative">
          {activeTab === "dieta" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">Tu Plan de Dieta</h2>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={generating || !hasProfile}
                  onClick={() => void generatePlan("dieta")}
                >
                  {generating ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 h-4 w-4" />
                  )}
                  {dietPlan ? "Regenerar" : "Generar"}
                </Button>
              </div>

              {!dietPlan && !generating && (
                <div className="glass-card rounded-xl p-8 text-center">
                  <Utensils className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="text-muted-foreground">Genera tu plan de dieta personalizado con IA</p>
                  <Button className="mt-4" onClick={() => void generatePlan("dieta")} disabled={!hasProfile}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generar dieta
                  </Button>
                </div>
              )}

              {generating && activeTab === "dieta" && (
                <div className="glass-card rounded-xl p-8 text-center">
                  <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground">Generando tu plan personalizado con IA...</p>
                </div>
              )}

              {dietPlan && !generating && dietPlan.meals.map((meal, index) => (
                <div key={index} className="glass-card rounded-xl p-5">
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="font-display font-semibold text-primary">{meal.meal}</h3>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">{meal.cal}</span>
                  </div>
                  <p className={`text-sm ${!isSubscribed && index > 1 ? "select-none blur-sm" : ""}`}>
                    {meal.items}
                  </p>
                </div>
              ))}

              {dietPlan && !generating && (
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-semibold">Total</span>
                    <span className="font-medium tabular-nums text-primary">{dietPlan.totalCal}</span>
                  </div>
                  <div className={`mt-2 flex gap-4 text-xs text-muted-foreground ${!isSubscribed ? "select-none blur-sm" : ""}`}>
                    <span>Proteinas: {dietPlan.macros.proteinas}</span>
                    <span>Carbos: {dietPlan.macros.carbohidratos}</span>
                    <span>Grasas: {dietPlan.macros.grasas}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "rutina" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">Tu Rutina Semanal</h2>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={generating || !hasProfile}
                  onClick={() => void generatePlan("rutina")}
                >
                  {generating ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 h-4 w-4" />
                  )}
                  {routinePlan ? "Regenerar" : "Generar"}
                </Button>
              </div>

              {!routinePlan && !generating && (
                <div className="glass-card rounded-xl p-8 text-center">
                  <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="text-muted-foreground">Genera tu rutina semanal personalizada con IA</p>
                  <Button className="mt-4" onClick={() => void generatePlan("rutina")} disabled={!hasProfile}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generar rutina
                  </Button>
                </div>
              )}

              {generating && activeTab === "rutina" && (
                <div className="glass-card rounded-xl p-8 text-center">
                  <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground">Generando tu rutina personalizada con IA...</p>
                </div>
              )}

              {routinePlan && !generating && routinePlan.days.map((day, index) => (
                <div key={index} className="glass-card rounded-xl p-5">
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="font-display font-semibold">{day.day}</h3>
                    <span className="text-xs font-medium text-primary">{day.focus}</span>
                  </div>
                  <p className={`text-sm text-muted-foreground ${!isSubscribed && index > 1 ? "select-none blur-sm" : ""}`}>
                    {day.exercises}
                  </p>
                </div>
              ))}
            </div>
          )}

          {!isSubscribed && (dietPlan || routinePlan) && (
            <div className="absolute bottom-0 left-0 right-0 flex h-64 flex-col items-center justify-end bg-gradient-to-t from-background via-background/95 to-transparent pb-8">
              <Lock className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-display text-lg font-bold">Desbloquea tu plan completo</h3>
              <p className="mb-4 text-sm text-muted-foreground">Suscribete por solo AR$ 15.000/mes</p>
              <Button variant="hero" size="lg" onClick={() => void handleSubscribe()} disabled={billingLoading === "checkout"}>
                {billingLoading === "checkout" ? "Redirigiendo..." : "Suscribirse ahora"}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
