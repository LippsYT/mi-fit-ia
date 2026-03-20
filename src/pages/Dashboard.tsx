import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dumbbell, RefreshCw, User, Lock, Utensils, Calendar, Loader2, Sparkles } from "lucide-react";
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<"dieta" | "rutina">("dieta");
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [routinePlan, setRoutinePlan] = useState<RoutinePlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const isSubscribed = profile?.is_subscribed ?? false;

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("peso, altura, edad, genero, objetivo, actividad, dias, is_subscribed").eq("id", user.id).single();
    if (data) setProfile(data as Profile);
  }, [user]);

  const fetchPlans = useCallback(async () => {
    if (!user) return;
    const { data: plans } = await supabase
      .from("generated_plans")
      .select("plan_type, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (plans) {
      const diet = plans.find((p: any) => p.plan_type === "dieta");
      const routine = plans.find((p: any) => p.plan_type === "rutina");
      if (diet) setDietPlan(diet.content as unknown as DietPlan);
      if (routine) setRoutinePlan(routine.content as unknown as RoutinePlan);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }

    const load = async () => {
      setLoadingData(true);
      await Promise.all([fetchProfile(), fetchPlans()]);
      setLoadingData(false);
    };
    load();
  }, [user, authLoading, navigate, fetchProfile, fetchPlans]);

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

      if (planType === "dieta") setDietPlan(data.plan);
      else setRoutinePlan(data.plan);

      toast({ title: `¡${planType === "dieta" ? "Dieta" : "Rutina"} generada!` });
    } catch (err: any) {
      toast({ title: "Error generando plan", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const objectiveLabels: Record<string, string> = {
    "perder-peso": "Perder peso",
    "ganar-musculo": "Ganar músculo",
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
      {/* Top bar */}
      <header className="border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between section-padding">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
            <Dumbbell className="h-6 w-6 text-primary" />
            <span>FIT AI</span>
            <span className="text-primary">SYSTEM</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/formulario">
              <Button variant="ghost" size="sm"><User className="mr-1 h-4 w-4" />Editar datos</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/"); }}>Salir</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto section-padding py-8">
        {/* Profile summary */}
        {hasProfile && (
          <div className="mb-8 glass-card rounded-xl p-6">
            <h2 className="mb-3 font-display text-lg font-semibold">Tu perfil</h2>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><span className="text-muted-foreground">Peso:</span> <span className="font-medium">{profile.peso} kg</span></div>
              <div><span className="text-muted-foreground">Altura:</span> <span className="font-medium">{profile.altura} cm</span></div>
              <div><span className="text-muted-foreground">Edad:</span> <span className="font-medium">{profile.edad} años</span></div>
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

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <Button variant={activeTab === "dieta" ? "default" : "secondary"} onClick={() => setActiveTab("dieta")} size="sm">
            <Utensils className="mr-1 h-4 w-4" />Plan de dieta
          </Button>
          <Button variant={activeTab === "rutina" ? "default" : "secondary"} onClick={() => setActiveTab("rutina")} size="sm">
            <Calendar className="mr-1 h-4 w-4" />Rutina semanal
          </Button>
        </div>

        {/* Content */}
        <div className="relative">
          {activeTab === "dieta" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">Tu Plan de Dieta</h2>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={generating || !hasProfile}
                  onClick={() => generatePlan("dieta")}
                >
                  {generating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
                  {dietPlan ? "Regenerar" : "Generar"}
                </Button>
              </div>

              {!dietPlan && !generating && (
                <div className="glass-card rounded-xl p-8 text-center">
                  <Utensils className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="text-muted-foreground">Genera tu plan de dieta personalizado con IA</p>
                  <Button className="mt-4" onClick={() => generatePlan("dieta")} disabled={!hasProfile}>
                    <Sparkles className="mr-2 h-4 w-4" />Generar dieta
                  </Button>
                </div>
              )}

              {generating && activeTab === "dieta" && (
                <div className="glass-card rounded-xl p-8 text-center">
                  <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground">Generando tu plan personalizado con IA...</p>
                </div>
              )}

              {dietPlan && !generating && dietPlan.meals.map((meal, i) => (
                <div key={i} className="glass-card rounded-xl p-5">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-display font-semibold text-primary">{meal.meal}</h3>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">{meal.cal}</span>
                  </div>
                  <p className={`text-sm ${!isSubscribed && i > 1 ? "blur-sm select-none" : ""}`}>
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
                  <div className={`mt-2 flex gap-4 text-xs text-muted-foreground ${!isSubscribed ? "blur-sm select-none" : ""}`}>
                    <span>Proteínas: {dietPlan.macros.proteinas}</span>
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
                  onClick={() => generatePlan("rutina")}
                >
                  {generating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
                  {routinePlan ? "Regenerar" : "Generar"}
                </Button>
              </div>

              {!routinePlan && !generating && (
                <div className="glass-card rounded-xl p-8 text-center">
                  <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="text-muted-foreground">Genera tu rutina semanal personalizada con IA</p>
                  <Button className="mt-4" onClick={() => generatePlan("rutina")} disabled={!hasProfile}>
                    <Sparkles className="mr-2 h-4 w-4" />Generar rutina
                  </Button>
                </div>
              )}

              {generating && activeTab === "rutina" && (
                <div className="glass-card rounded-xl p-8 text-center">
                  <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground">Generando tu rutina personalizada con IA...</p>
                </div>
              )}

              {routinePlan && !generating && routinePlan.days.map((day, i) => (
                <div key={i} className="glass-card rounded-xl p-5">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-display font-semibold">{day.day}</h3>
                    <span className="text-xs font-medium text-primary">{day.focus}</span>
                  </div>
                  <p className={`text-sm text-muted-foreground ${!isSubscribed && i > 1 ? "blur-sm select-none" : ""}`}>
                    {day.exercises}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Paywall overlay */}
          {!isSubscribed && (dietPlan || routinePlan) && (
            <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-background via-background/95 to-transparent flex flex-col items-center justify-end pb-8">
              <Lock className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-display text-lg font-bold">Desbloquea tu plan completo</h3>
              <p className="mb-4 text-sm text-muted-foreground">Suscríbete por solo $7/mes</p>
              <Button variant="hero" size="lg">Suscribirse ahora</Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
