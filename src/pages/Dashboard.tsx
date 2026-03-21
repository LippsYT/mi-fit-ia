import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Apple, Bot, Calendar, CheckCircle2, Crown, Dumbbell, Flame, Loader2, Lock, Scale, Sparkles, Target, TrendingUp, User, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  normalizePlanForStorage,
  normalizePremiumPlan,
  type DailyNutritionAnalysis,
  type DailyMealInput,
  type FitnessProfile,
  type NutritionConsultation,
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

type NutritionLog = {
  ai_summary: string | null;
  calories: number;
  carbs: number;
  created_at: string;
  eaten_at: string;
  fats: number;
  food_description: string | null;
  id: string;
  meal_name: string;
  meal_type: string | null;
  notes: string | null;
  protein: number;
  updated_at: string;
};

type ProgressCheckin = {
  adherence_score: number | null;
  checkin_date: string;
  created_at: string;
  energy_level: number | null;
  id: string;
  notes: string | null;
  updated_at: string;
  waist: number | null;
  weight: number | null;
};

type MealFormState = {
  calories: string;
  carbs: string;
  fats: string;
  meal_name: string;
  notes: string;
  protein: string;
};

type CheckinFormState = {
  adherence_score: string;
  energy_level: string;
  notes: string;
  waist: string;
  weight: string;
};

type DailyMealFormState = {
  almuerzo: string;
  cena: string;
  desayuno: string;
  snacks: string;
};

type AiConsultationRow = {
  action_steps: string[];
  answer: string;
  consultation_type: string;
  context_payload: Record<string, unknown>;
  created_at: string;
  id: string;
  question: string;
};

type WorkoutProgressRow = {
  completed: boolean;
  completed_at: string | null;
  id: string;
  plan_id: string;
  workout_day: string;
};

type DailyTargets = {
  calories: number;
  carbs: number;
  fats: number;
  hydrationLiters: number;
  protein: number;
  steps: number;
};

const previewSections = 2;

const initialMealForm: MealFormState = {
  calories: "",
  carbs: "",
  fats: "",
  meal_name: "",
  notes: "",
  protein: "",
};

const initialCheckinForm: CheckinFormState = {
  adherence_score: "4",
  energy_level: "4",
  notes: "",
  waist: "",
  weight: "",
};

const initialDailyMealForm: DailyMealFormState = {
  almuerzo: "",
  cena: "",
  desayuno: "",
  snacks: "",
};

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

function roundToNearest(value: number, nearest: number) {
  return Math.round(value / nearest) * nearest;
}

function estimateDailyTargets(profile: FitnessProfile | null): DailyTargets | null {
  if (!profile?.weight || !profile?.height || !profile?.age) {
    return null;
  }

  const genderFactor = profile.gender === "masculino" ? 5 : profile.gender === "femenino" ? -161 : -78;
  const bmr = (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age) + genderFactor;
  const activityMultiplier =
    profile.activity_level === "alto" ? 1.725 :
    profile.activity_level === "moderado" ? 1.55 :
    profile.activity_level === "ligero" ? 1.375 :
    1.2;
  const goalAdjustment =
    profile.goal === "bajar_grasa" ? -450 :
    profile.goal === "ganar_musculo" ? 250 :
    0;
  const calories = roundToNearest(Math.max(1300, bmr * activityMultiplier + goalAdjustment), 50);
  const protein = roundToNearest(profile.weight * (profile.goal === "ganar_musculo" ? 2.1 : profile.goal === "bajar_grasa" ? 1.9 : 1.7), 5);
  const fats = roundToNearest(Math.max(45, profile.weight * 0.8), 5);
  const carbs = roundToNearest(Math.max(0, calories - (protein * 4) - (fats * 9)) / 4, 5);

  return {
    calories,
    carbs,
    fats,
    hydrationLiters: Number((profile.weight * 0.035).toFixed(1)),
    protein,
    steps: profile.goal === "bajar_grasa" ? 10000 : 8000,
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR").format(Math.round(value));
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
}

function isToday(dateLike: string) {
  return dateLike.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function toNumericString(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function mealLabel(value: string) {
  switch (value) {
    case "desayuno":
      return "Desayuno";
    case "almuerzo":
      return "Almuerzo";
    case "cena":
      return "Cena";
    case "snacks":
      return "Snacks";
    default:
      return "Comida";
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { loading: authLoading, session, signOut, user } = useAuth();
  const [profile, setProfile] = useState<FitnessProfile | null>(null);
  const [dietPlan, setDietPlan] = useState<StoredPlan | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<StoredPlan | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [nutritionLogs, setNutritionLogs] = useState<NutritionLog[]>([]);
  const [progressCheckins, setProgressCheckins] = useState<ProgressCheckin[]>([]);
  const [consultations, setConsultations] = useState<AiConsultationRow[]>([]);
  const [workoutProgress, setWorkoutProgress] = useState<WorkoutProgressRow[]>([]);
  const [activeTab, setActiveTab] = useState<PlanType>("dieta");
  const [loadingData, setLoadingData] = useState(true);
  const [generating, setGenerating] = useState<PlanType | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [mealSaving, setMealSaving] = useState(false);
  const [checkinSaving, setCheckinSaving] = useState(false);
  const [consultationLoading, setConsultationLoading] = useState(false);
  const [workoutSaving, setWorkoutSaving] = useState<string | null>(null);
  const [mealForm, setMealForm] = useState<MealFormState>(initialMealForm);
  const [checkinForm, setCheckinForm] = useState<CheckinFormState>(initialCheckinForm);
  const [dailyMealForm, setDailyMealForm] = useState<DailyMealFormState>(initialDailyMealForm);
  const [consultationQuestion, setConsultationQuestion] = useState("");

  const getFunctionHeaders = async () => {
    const currentSessionResult = await supabase.auth.getSession();
    let activeSession = currentSessionResult.data.session ?? session;

    if (!activeSession?.access_token) {
      return null;
    }

    const expiresSoon = activeSession.expires_at
      ? (activeSession.expires_at * 1000) <= (Date.now() + 60_000)
      : false;

    if (expiresSoon) {
      const refreshedSessionResult = await supabase.auth.refreshSession();
      if (refreshedSessionResult.error) {
        console.error("No se pudo refrescar la sesion antes de invocar la edge function", refreshedSessionResult.error);
      } else {
        activeSession = refreshedSessionResult.data.session ?? activeSession;
      }
    }

    return activeSession?.access_token
      ? { Authorization: `Bearer ${activeSession.access_token}` }
      : null;
  };

  const hasPremiumAccess = useMemo(() => isActiveSubscription(subscription), [subscription]);
  const activePlan = activeTab === "dieta" ? dietPlan : workoutPlan;
  const dailyTargets = useMemo(() => estimateDailyTargets(profile), [profile]);
  const todayNutrition = useMemo(() => {
    const todayLogs = nutritionLogs.filter((log) => isToday(log.eaten_at));

    return todayLogs.reduce(
      (acc, log) => ({
        calories: acc.calories + Number(log.calories ?? 0),
        carbs: acc.carbs + Number(log.carbs ?? 0),
        fats: acc.fats + Number(log.fats ?? 0),
        protein: acc.protein + Number(log.protein ?? 0),
      }),
      { calories: 0, carbs: 0, fats: 0, protein: 0 },
    );
  }, [nutritionLogs]);
  const latestCheckin = progressCheckins[0] ?? null;
  const latestNutritionFeedback = useMemo(
    () => consultations.find((item) => item.consultation_type === "nutrition_feedback") ?? null,
    [consultations],
  );
  const quickConsultations = useMemo(
    () => consultations.filter((item) => item.consultation_type === "quick_question").slice(0, 4),
    [consultations],
  );
  const workoutProgressMap = useMemo(() => {
    return new Map(
      workoutProgress
        .filter((item) => item.plan_id === workoutPlan?.id)
        .map((item) => [item.workout_day, item]),
    );
  }, [workoutPlan?.id, workoutProgress]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    const loadDashboard = async () => {
      setLoadingData(true);

      const [profileResult, plansResult, subscriptionResult, nutritionResult, checkinsResult, consultationsResult, workoutProgressResult] = await Promise.all([
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
        supabase
          .from("nutrition_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("eaten_at", { ascending: false })
          .limit(12),
        supabase
          .from("progress_checkins")
          .select("*")
          .eq("user_id", user.id)
          .order("checkin_date", { ascending: false })
          .limit(6),
        supabase
          .from("ai_consultations")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("workout_progress")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(20),
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
      if (nutritionResult.error) {
        console.error("Error cargando nutrition_logs", nutritionResult.error);
      }
      if (checkinsResult.error) {
        console.error("Error cargando progress_checkins", checkinsResult.error);
      }
      if (consultationsResult.error) {
        console.error("Error cargando ai_consultations", consultationsResult.error);
      }
      if (workoutProgressResult.error) {
        console.error("Error cargando workout_progress", workoutProgressResult.error);
      }

      const nextProfile = (profileResult.data as FitnessProfile | null) ?? null;
      const nextCheckins = (checkinsResult.data as ProgressCheckin[] | null) ?? [];

      setProfile(nextProfile);
      setSubscription((subscriptionResult.data as SubscriptionRow | null) ?? null);
      setNutritionLogs((nutritionResult.data as NutritionLog[] | null) ?? []);
      setProgressCheckins(nextCheckins);
      setConsultations((((consultationsResult.data as any[] | null) ?? [])).map((item) => ({
        ...item,
        action_steps: Array.isArray(item.action_steps) ? item.action_steps : [],
        context_payload: item.context_payload && typeof item.context_payload === "object" ? item.context_payload : {},
      })));
      setWorkoutProgress((workoutProgressResult.data as WorkoutProgressRow[] | null) ?? []);
      setCheckinForm((current) => ({
        ...current,
        weight: current.weight || toNumericString(nextCheckins[0]?.weight ?? nextProfile?.weight),
        waist: current.waist || toNumericString(nextCheckins[0]?.waist),
      }));

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
    const headers = await getFunctionHeaders();
    if (!headers) {
      toast({
        title: "Debes iniciar sesion",
        description: "No pudimos validar tu sesion para generar el plan.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }
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
      const { data: generatedResponse, error: generateError } = await supabase.functions.invoke("generate-plan", {
        body: { planType },
        headers,
      });

      if (generateError) {
        console.error("Error invocando generate-plan", generateError, { planType });
        throw new Error(generateError.message || "No se pudo generar el plan desde el backend");
      }

      const generated = generatedResponse?.result;
      if (!generated) {
        console.error("generate-plan devolvio una respuesta invalida", generatedResponse);
        throw new Error("La funcion generate-plan no devolvio contenido valido");
      }

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

  const handleSaveMeal = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) return;
    if (!hasPremiumAccess) {
      toast({
        title: "Funcion premium",
        description: "El seguimiento nutricional diario se desbloquea con la suscripcion premium.",
      });
      return;
    }

    if (!mealForm.meal_name.trim() || !mealForm.calories.trim()) {
      toast({
        title: "Completa la comida",
        description: "Necesitamos al menos el nombre de la comida y las calorias.",
        variant: "destructive",
      });
      return;
    }

    setMealSaving(true);

    const payload = {
      user_id: user.id,
      meal_name: mealForm.meal_name.trim(),
      calories: Number(mealForm.calories) || 0,
      protein: Number(mealForm.protein) || 0,
      carbs: Number(mealForm.carbs) || 0,
      fats: Number(mealForm.fats) || 0,
      notes: mealForm.notes.trim() || null,
    };

    const { data, error } = await supabase
      .from("nutrition_logs")
      .insert(payload)
      .select("*")
      .single();

    setMealSaving(false);

    if (error) {
      console.error("Error guardando nutrition_logs", error, payload);
      toast({
        title: "No se pudo guardar la comida",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setNutritionLogs((current) => [data as NutritionLog, ...current]
      .sort((a, b) => new Date(b.eaten_at).getTime() - new Date(a.eaten_at).getTime())
      .slice(0, 12));
    setMealForm(initialMealForm);

    toast({
      title: "Comida registrada",
      description: "El seguimiento de calorias y macros de hoy ya fue actualizado.",
    });
  };

  const handleAnalyzeDailyMeals = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user || !profile) return;
    const headers = await getFunctionHeaders();
    if (!headers) {
      toast({
        title: "Debes iniciar sesion",
        description: "No pudimos validar tu sesion para analizar tus comidas.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }
    if (!hasPremiumAccess) {
      toast({
        title: "Funcion premium",
        description: "El seguimiento diario con analisis IA se desbloquea con la suscripcion premium.",
      });
      return;
    }

    const meals = Object.fromEntries(
      Object.entries(dailyMealForm).map(([key, value]) => [key, value.trim()]),
    ) as DailyMealInput;

    if (!Object.values(meals).some(Boolean)) {
      toast({
        title: "Completa tu dia",
        description: "Escribe al menos una comida para que la IA la analice.",
        variant: "destructive",
      });
      return;
    }

    setMealSaving(true);

    try {
      const { data: analysis, error: analysisError } = await supabase.functions.invoke("analyze-meals", {
        body: {
          meals,
          profile,
          targets: dailyTargets,
        },
        headers,
      });

      if (analysisError) {
        console.error("Error invocando analyze-meals", analysisError);
        throw new Error(analysisError.message || "No se pudo analizar el dia desde el backend");
      }

      if (!analysis) {
        throw new Error("La funcion analyze-meals no devolvio contenido valido");
      }

      const parsedAnalysis = analysis as DailyNutritionAnalysis;
      const rows = parsedAnalysis.meals.map((meal) => ({
        user_id: user.id,
        meal_name: mealLabel(meal.meal_type),
        meal_type: meal.meal_type,
        food_description: meal.text,
        ai_summary: meal.summary,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fats: meal.fats,
        notes: null,
      }));

      const { data: insertedLogs, error: logsError } = await supabase
        .from("nutrition_logs")
        .insert(rows)
        .select("*");

      if (logsError) {
        throw logsError;
      }

      const feedbackPayload = {
        user_id: user.id,
        consultation_type: "nutrition_feedback",
        question: "Feedback nutricional del dia",
        answer: parsedAnalysis.coach_message,
        action_steps: parsedAnalysis.improve,
        context_payload: {
          next_meal: parsedAnalysis.next_meal,
          strengths: parsedAnalysis.strengths,
          totals: parsedAnalysis.totals,
        },
      };

      const { data: feedbackRow, error: feedbackError } = await supabase
        .from("ai_consultations")
        .insert(feedbackPayload)
        .select("*")
        .single();

      if (feedbackError) {
        throw feedbackError;
      }

      setNutritionLogs((current) => [...((insertedLogs as NutritionLog[] | null) ?? []), ...current]
        .sort((a, b) => new Date(b.eaten_at).getTime() - new Date(a.eaten_at).getTime())
        .slice(0, 20));
      setConsultations((current) => [
        {
          ...(feedbackRow as any),
          action_steps: Array.isArray((feedbackRow as any).action_steps) ? (feedbackRow as any).action_steps : [],
          context_payload: (feedbackRow as any).context_payload && typeof (feedbackRow as any).context_payload === "object" ? (feedbackRow as any).context_payload : {},
        },
        ...current,
      ].slice(0, 8));
      setDailyMealForm(initialDailyMealForm);

      toast({
        title: "Dia analizado",
        description: "Tu nutricionista IA ya analizo tus comidas y guardo el seguimiento.",
      });
    } catch (error: any) {
      console.error("Error analizando comidas del dia", error);
      toast({
        title: "No se pudo analizar tu dia",
        description: error.message ?? "Error inesperado",
        variant: "destructive",
      });
    } finally {
      setMealSaving(false);
    }
  };

  const handleSaveCheckin = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) return;
    if (!hasPremiumAccess) {
      toast({
        title: "Funcion premium",
        description: "Los check-ins y el seguimiento de progreso forman parte del premium.",
      });
      return;
    }

    if (!checkinForm.weight.trim()) {
      toast({
        title: "Falta el peso actual",
        description: "Necesitamos tu peso para guardar el check-in.",
        variant: "destructive",
      });
      return;
    }

    setCheckinSaving(true);

    const payload = {
      user_id: user.id,
      checkin_date: new Date().toISOString().slice(0, 10),
      weight: Number(checkinForm.weight) || null,
      waist: Number(checkinForm.waist) || null,
      energy_level: Number(checkinForm.energy_level) || null,
      adherence_score: Number(checkinForm.adherence_score) || null,
      notes: checkinForm.notes.trim() || null,
    };

    const { data, error } = await supabase
      .from("progress_checkins")
      .upsert(payload, { onConflict: "user_id,checkin_date" })
      .select("*")
      .single();

    if (!error && payload.weight) {
      const { error: profileError } = await supabase
        .from("fitness_profiles")
        .update({ weight: payload.weight })
        .eq("user_id", user.id);

      if (profileError) {
        console.error("No se pudo sincronizar el peso con fitness_profiles", profileError);
      } else {
        setProfile((current) => current ? { ...current, weight: payload.weight } : current);
      }
    }

    setCheckinSaving(false);

    if (error) {
      console.error("Error guardando progress_checkins", error, payload);
      toast({
        title: "No se pudo guardar el check-in",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setProgressCheckins((current) => [data as ProgressCheckin, ...current.filter((item) => item.checkin_date !== (data as ProgressCheckin).checkin_date)]
      .sort((a, b) => new Date(b.checkin_date).getTime() - new Date(a.checkin_date).getTime())
      .slice(0, 6));

    toast({
      title: "Check-in guardado",
      description: "Tu progreso de hoy ya fue registrado.",
    });
  };

  const handleConsultation = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user || !profile) return;
    const headers = await getFunctionHeaders();
    if (!headers) {
      toast({
        title: "Debes iniciar sesion",
        description: "No pudimos validar tu sesion para consultar al coach.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }
    if (!hasPremiumAccess) {
      toast({
        title: "Funcion premium",
        description: "La consulta rapida con tu nutricionista IA es parte del premium.",
      });
      return;
    }

    if (!consultationQuestion.trim()) {
      toast({
        title: "Escribe una consulta",
        description: "Haz una pregunta concreta para recibir una respuesta util.",
        variant: "destructive",
      });
      return;
    }

    setConsultationLoading(true);

    try {
      const contextSummary = [
        dailyTargets ? `Meta diaria ${dailyTargets.calories} kcal` : "",
        `Consumido hoy ${todayNutrition.calories} kcal`,
        latestCheckin?.weight ? `Ultimo peso ${latestCheckin.weight} kg` : "",
      ].filter(Boolean).join(" | ");

      const { data: consultation, error: consultationError } = await supabase.functions.invoke("ask-coach", {
        body: {
          question: consultationQuestion,
          profile,
          contextSummary,
        },
        headers,
      });

      if (consultationError) {
        console.error("Error invocando ask-coach", consultationError);
        throw new Error(consultationError.message || "No se pudo consultar al coach desde el backend");
      }

      if (!consultation) {
        throw new Error("La funcion ask-coach no devolvio contenido valido");
      }

      const parsedConsultation = consultation as NutritionConsultation;

      const payload = {
        user_id: user.id,
        consultation_type: "quick_question",
        question: consultationQuestion.trim(),
        answer: parsedConsultation.answer,
        action_steps: parsedConsultation.action_steps,
        context_payload: {},
      };

      const { data, error } = await supabase
        .from("ai_consultations")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      setConsultations((current) => [
        {
          ...(data as any),
          action_steps: Array.isArray((data as any).action_steps) ? (data as any).action_steps : [],
          context_payload: (data as any).context_payload && typeof (data as any).context_payload === "object" ? (data as any).context_payload : {},
        },
        ...current,
      ].slice(0, 8));
      setConsultationQuestion("");
    } catch (error: any) {
      console.error("Error generando consulta IA", error);
      toast({
        title: "No se pudo responder tu consulta",
        description: error.message ?? "Error inesperado",
        variant: "destructive",
      });
    } finally {
      setConsultationLoading(false);
    }
  };

  const handleToggleWorkoutDay = async (dayTitle: string) => {
    if (!user || !workoutPlan || !hasPremiumAccess) return;

    setWorkoutSaving(dayTitle);

    try {
      const current = workoutProgressMap.get(dayTitle);
      const completed = !current?.completed;
      const payload = {
        user_id: user.id,
        plan_id: workoutPlan.id,
        workout_day: dayTitle,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      };

      const { data, error } = await supabase
        .from("workout_progress")
        .upsert(payload, { onConflict: "user_id,plan_id,workout_day" })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      setWorkoutProgress((currentRows) => [
        data as WorkoutProgressRow,
        ...currentRows.filter((item) => !(item.plan_id === workoutPlan.id && item.workout_day === dayTitle)),
      ]);
    } catch (error: any) {
      console.error("Error actualizando workout_progress", error);
      toast({
        title: "No se pudo guardar el avance",
        description: error.message ?? "Error inesperado",
        variant: "destructive",
      });
    } finally {
      setWorkoutSaving(null);
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
                {hasPremiumAccess ? "Tu coach premium diario" : "Vista previa premium"}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {hasPremiumAccess
                  ? "Tu dashboard ahora combina plan, seguimiento nutricional, check-ins de progreso y objetivos diarios para acercarse a una experiencia de coach real."
                  : "El premium desbloquea seguimiento diario de comidas, control de calorias y macros, check-ins de progreso y planes mucho mas accionables."}
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
                    Suscribirme por AR$ 11.499
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

        {dailyTargets && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="glass-card rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Flame className="h-4 w-4 text-primary" />
                Calorias de hoy
              </div>
              <div className="text-2xl font-bold">{formatNumber(todayNutrition.calories)} / {formatNumber(dailyTargets.calories)}</div>
              <Progress className="mt-3" value={clampPercentage((todayNutrition.calories / dailyTargets.calories) * 100)} />
            </div>

            <div className="glass-card rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Apple className="h-4 w-4 text-primary" />
                Proteina
              </div>
              <div className="text-2xl font-bold">{formatNumber(todayNutrition.protein)} g</div>
              <p className="mt-2 text-sm text-muted-foreground">Meta diaria: {formatNumber(dailyTargets.protein)} g</p>
            </div>

            <div className="glass-card rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4 text-primary" />
                Objetivo diario
              </div>
              <div className="text-2xl font-bold">{formatNumber(dailyTargets.steps)}</div>
              <p className="mt-2 text-sm text-muted-foreground">pasos sugeridos y {dailyTargets.hydrationLiters} L de agua</p>
            </div>

            <div className="glass-card rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                Ultimo check-in
              </div>
              <div className="text-2xl font-bold">{latestCheckin?.weight ? `${latestCheckin.weight} kg` : "--"}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {latestCheckin ? `Adherencia ${latestCheckin.adherence_score ?? "-"} / 5` : "Todavia no registraste progreso"}
              </p>
            </div>
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

              {Boolean(activePlan.content.highlights?.length) && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {activePlan.content.highlights?.map((highlight) => (
                    <span key={highlight} className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {highlight}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-6 space-y-4">
                {activePlan.content.sections.map((section, index) => {
                  const locked = !hasPremiumAccess && index >= previewSections;
                  const workoutProgressRow = activeTab === "rutina" ? workoutProgressMap.get(section.title) : null;

                  return (
                    <div key={`${section.title}-${index}`} className="rounded-xl border border-border/60 bg-background/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-display text-lg font-semibold">{section.title}</h4>
                          {activeTab === "rutina" && workoutProgressRow?.completed ? (
                            <p className="mt-1 text-xs font-medium text-primary">Dia completado</p>
                          ) : null}
                        </div>
                        {activeTab === "rutina" ? (
                          <Button
                            size="sm"
                            variant={workoutProgressRow?.completed ? "default" : "outline"}
                            disabled={!hasPremiumAccess || savingWorkoutDay === section.title}
                            onClick={() => void handleToggleWorkoutDay(section.title)}
                          >
                            {savingWorkoutDay === section.title ? "Guardando..." : workoutProgressRow?.completed ? "Hecho" : "Marcar"}
                          </Button>
                        ) : null}
                      </div>
                      <ul className={`mt-3 space-y-2 text-sm text-muted-foreground ${locked ? "select-none blur-sm" : ""}`}>
                        {section.bullets.map((bullet) => (
                          <li key={bullet} className="flex gap-2">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              {Boolean(activePlan.content.coach_notes?.length) && (
                <div className={`mt-6 rounded-xl border border-primary/15 bg-primary/5 p-4 ${!hasPremiumAccess ? "select-none blur-sm" : ""}`}>
                  <h4 className="font-display text-lg font-semibold">Observaciones del coach</h4>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {activePlan.content.coach_notes?.map((note) => (
                      <li key={note} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className={`mt-6 text-sm leading-relaxed text-muted-foreground ${!hasPremiumAccess ? "select-none blur-sm" : ""}`}>
                {activePlan.content.closing}
              </p>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <div className={`glass-card rounded-2xl p-6 ${!hasPremiumAccess ? "relative overflow-hidden" : ""}`}>
              {!hasPremiumAccess && <div className="absolute inset-0 z-10 bg-background/45 backdrop-blur-[2px]" />}

              <div className={!hasPremiumAccess ? "select-none blur-sm" : ""}>
                <div className="mb-5 flex items-center gap-2">
                  <Apple className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-xl font-bold">Seguimiento nutricional diario</h3>
                </div>

                <form onSubmit={handleAnalyzeDailyMeals} className="space-y-4">
                  {([
                    ["desayuno", "Desayuno"],
                    ["almuerzo", "Almuerzo"],
                    ["cena", "Cena"],
                    ["snacks", "Snacks"],
                  ] as Array<[keyof DailyMealFormState, string]>).map(([key, label]) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={key}>{label}</Label>
                      <Textarea
                        id={key}
                        value={dailyMealForm[key]}
                        onChange={(event) => setDailyMealForm((current) => ({ ...current, [key]: event.target.value }))}
                        placeholder={`Ej: ${label.toLowerCase()} con alimentos y cantidades aproximadas`}
                      />
                    </div>
                  ))}

                  <Button type="submit" variant="hero" disabled={mealSaving}>
                    {mealSaving ? "Analizando..." : "Analizar mi dia con IA"}
                  </Button>
                </form>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                    <div className="text-sm text-muted-foreground">Hoy consumido</div>
                    <div className="mt-2 text-2xl font-bold">{formatNumber(todayNutrition.calories)} kcal</div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      P {formatNumber(todayNutrition.protein)}g · C {formatNumber(todayNutrition.carbs)}g · G {formatNumber(todayNutrition.fats)}g
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                    <div className="text-sm text-muted-foreground">Meta estimada</div>
                    <div className="mt-2 text-2xl font-bold">{dailyTargets ? `${formatNumber(dailyTargets.calories)} kcal` : "--"}</div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      P {dailyTargets ? formatNumber(dailyTargets.protein) : "--"}g · C {dailyTargets ? formatNumber(dailyTargets.carbs) : "--"}g · G {dailyTargets ? formatNumber(dailyTargets.fats) : "--"}g
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-primary/15 bg-primary/5 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    <h4 className="font-display text-lg font-semibold">Feedback del nutricionista IA</h4>
                  </div>
                  {latestNutritionFeedback ? (
                    <>
                      <p className="text-sm leading-relaxed text-muted-foreground">{latestNutritionFeedback.answer}</p>
                      {latestNutritionFeedback.action_steps.length ? (
                        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                          {latestNutritionFeedback.action_steps.map((step) => (
                            <li key={step} className="flex gap-2">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Cuando registres tu dia, tu nutricionista IA te dira que hiciste bien, que mejorar y que te conviene comer despues.
                    </p>
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  <h4 className="font-display text-lg font-semibold">Ultimas comidas</h4>
                  {nutritionLogs.length ? nutritionLogs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-border/60 bg-background/20 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium">{log.meal_name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {log.food_description ?? new Date(log.eaten_at).toLocaleString("es-AR")}
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div className="font-semibold text-foreground">{formatNumber(log.calories)} kcal</div>
                          <div>P {formatNumber(log.protein)} · C {formatNumber(log.carbs)} · G {formatNumber(log.fats)}</div>
                        </div>
                      </div>
                      {(log.ai_summary || log.notes) && <p className="mt-3 text-sm text-muted-foreground">{log.ai_summary ?? log.notes}</p>}
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">Todavia no registraste comidas.</p>
                  )}
                </div>
              </div>

              {!hasPremiumAccess && (
                <div className="absolute inset-x-0 bottom-0 z-20 p-6">
                  <div className="rounded-2xl border border-primary/20 bg-background/90 p-5 shadow-2xl backdrop-blur">
                    <h4 className="font-display text-lg font-bold">Premium con seguimiento real</h4>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Registra lo que comiste, controla calorias y macros del dia y usa el dashboard como una bitacora nutricional real.
                    </p>
                    <Button className="mt-4" variant="hero" onClick={() => void handleSubscribe()} disabled={checkoutLoading}>
                      Desbloquear premium
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className={`glass-card rounded-2xl p-6 ${!hasPremiumAccess ? "relative overflow-hidden" : ""}`}>
              {!hasPremiumAccess && <div className="absolute inset-0 z-10 bg-background/45 backdrop-blur-[2px]" />}

              <div className={!hasPremiumAccess ? "select-none blur-sm" : ""}>
                <div className="mb-5 flex items-center gap-2">
                  <Scale className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-xl font-bold">Check-in de progreso</h3>
                </div>

                <form onSubmit={handleSaveCheckin} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="checkin_weight">Peso actual</Label>
                      <Input
                        id="checkin_weight"
                        type="number"
                        value={checkinForm.weight}
                        onChange={(event) => setCheckinForm((current) => ({ ...current, weight: event.target.value }))}
                        placeholder="74.5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="checkin_waist">Cintura</Label>
                      <Input
                        id="checkin_waist"
                        type="number"
                        value={checkinForm.waist}
                        onChange={(event) => setCheckinForm((current) => ({ ...current, waist: event.target.value }))}
                        placeholder="82"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="checkin_energy">Energia (1-5)</Label>
                      <Input
                        id="checkin_energy"
                        type="number"
                        min="1"
                        max="5"
                        value={checkinForm.energy_level}
                        onChange={(event) => setCheckinForm((current) => ({ ...current, energy_level: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="checkin_adherence">Adherencia (1-5)</Label>
                      <Input
                        id="checkin_adherence"
                        type="number"
                        min="1"
                        max="5"
                        value={checkinForm.adherence_score}
                        onChange={(event) => setCheckinForm((current) => ({ ...current, adherence_score: event.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="checkin_notes">Notas del check-in</Label>
                    <Textarea
                      id="checkin_notes"
                      value={checkinForm.notes}
                      onChange={(event) => setCheckinForm((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="Ej: mejor descanso, mas fuerza, hambre alta a la tarde"
                    />
                  </div>

                  <Button type="submit" disabled={checkinSaving}>
                    {checkinSaving ? "Guardando..." : "Guardar check-in"}
                  </Button>
                </form>

                <div className="mt-6 space-y-3">
                  <h4 className="font-display text-lg font-semibold">Historial reciente</h4>
                  {progressCheckins.length ? progressCheckins.map((checkin) => (
                    <div key={checkin.id} className="rounded-xl border border-border/60 bg-background/20 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium">{new Date(checkin.checkin_date).toLocaleDateString("es-AR")}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Energia {checkin.energy_level ?? "-"} / 5 · Adherencia {checkin.adherence_score ?? "-"} / 5
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div className="font-semibold text-foreground">{checkin.weight ? `${checkin.weight} kg` : "--"}</div>
                          <div>{checkin.waist ? `${checkin.waist} cm cintura` : "Sin cintura"}</div>
                        </div>
                      </div>
                      {checkin.notes && <p className="mt-3 text-sm text-muted-foreground">{checkin.notes}</p>}
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">Todavia no registraste check-ins.</p>
                  )}
                </div>
              </div>

              {!hasPremiumAccess && (
                <div className="absolute inset-x-0 bottom-0 z-20 p-6">
                  <div className="rounded-2xl border border-primary/20 bg-background/90 p-5 shadow-2xl backdrop-blur">
                    <h4 className="font-display text-lg font-bold">Seguimiento como coach real</h4>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Guarda peso, cintura, energia y adherencia para tomar decisiones reales y no depender solo de un texto generado.
                    </p>
                    <Button className="mt-4" variant="hero" onClick={() => void handleSubscribe()} disabled={checkoutLoading}>
                      Activar premium
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={`glass-card rounded-2xl p-6 ${!hasPremiumAccess ? "relative overflow-hidden" : ""}`}>
            {!hasPremiumAccess && <div className="absolute inset-0 z-10 bg-background/45 backdrop-blur-[2px]" />}

            <div className={!hasPremiumAccess ? "select-none blur-sm" : ""}>
              <div className="mb-5 flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <h3 className="font-display text-xl font-bold">Consulta rapida con tu nutricionista IA</h3>
              </div>

              <form onSubmit={handleConsultation} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="consultation_question">Tu pregunta</Label>
                  <Textarea
                    id="consultation_question"
                    value={consultationQuestion}
                    onChange={(event) => setConsultationQuestion(event.target.value)}
                    placeholder="Ej: ¿Puedo comer pizza hoy? ¿Que me conviene cenar liviano? ¿Que snack me recomiendas?"
                  />
                </div>
                <Button type="submit" variant="hero" disabled={consultationLoading}>
                  {consultationLoading ? "Respondiendo..." : "Preguntar a mi coach IA"}
                </Button>
              </form>

              <div className="mt-6 space-y-3">
                <h4 className="font-display text-lg font-semibold">Respuestas recientes</h4>
                {quickConsultations.length ? quickConsultations.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border/60 bg-background/20 p-4">
                    <div className="text-sm font-medium text-primary">Pregunta</div>
                    <p className="mt-1 font-medium">{item.question}</p>
                    <div className="mt-4 text-sm font-medium text-primary">Respuesta</div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
                    {item.action_steps.length ? (
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {item.action_steps.map((step) => (
                          <li key={step} className="flex gap-2">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">
                    Todavia no hiciste consultas. Usa este espacio como si fuera tu nutricionista disponible 24/7.
                  </p>
                )}
              </div>
            </div>

            {!hasPremiumAccess && (
              <div className="absolute inset-x-0 bottom-0 z-20 p-6">
                <div className="rounded-2xl border border-primary/20 bg-background/90 p-5 shadow-2xl backdrop-blur">
                  <h4 className="font-display text-lg font-bold">Consulta premium 24/7</h4>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Pregunta si te conviene una comida, como ajustar tu cena o que snack elegir y recibe respuesta inmediata de la IA.
                  </p>
                  <Button className="mt-4" variant="hero" onClick={() => void handleSubscribe()} disabled={checkoutLoading}>
                    Activar premium
                  </Button>
                </div>
              </div>
            )}
          </div>

          {!hasPremiumAccess && activePlan && (
            <div className="glass-card rounded-2xl p-6 text-center">
              <Lock className="mx-auto mb-3 h-8 w-8 text-primary" />
              <h3 className="font-display text-lg font-bold">Desbloquea el coach premium completo</h3>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
                El premium ahora incluye plan completo, seguimiento nutricional diario, control de calorias y macros, check-ins de progreso y regeneracion orientada a resultados reales.
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
