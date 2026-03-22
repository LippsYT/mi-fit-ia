import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dumbbell, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAccessStatus } from "@/hooks/useAccessStatus";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const goalOptions = [
  { value: "bajar_grasa", label: "Bajar grasa" },
  { value: "ganar_musculo", label: "Ganar masa" },
  { value: "recomposicion", label: "Recomposicion" },
  { value: "salud", label: "Salud" },
];

const activityOptions = [
  { value: "sedentario", label: "Sedentario" },
  { value: "ligero", label: "Actividad ligera" },
  { value: "moderado", label: "Moderado" },
  { value: "alto", label: "Alto" },
];

const experienceOptions = [
  { value: "principiante", label: "Principiante" },
  { value: "intermedio", label: "Intermedio" },
  { value: "avanzado", label: "Avanzado" },
];

const trainingTypeOptions = [
  { value: "gym", label: "Gym" },
  { value: "casa", label: "Casa" },
  { value: "mixto", label: "Mixto" },
];

const budgetOptions = [
  { value: "bajo", label: "Ajustado" },
  { value: "medio", label: "Medio" },
  { value: "alto", label: "Amplio" },
];

const cookingTimeOptions = [
  { value: "muy_poco", label: "Muy poco" },
  { value: "medio", label: "Intermedio" },
  { value: "amplio", label: "Tengo tiempo" },
];

const sexOptions = [
  { value: "masculino", label: "Masculino" },
  { value: "femenino", label: "Femenino" },
  { value: "otro", label: "Otro" },
];

const stepTitles = [
  { title: "Base personal", description: "Definimos quien eres y hacia donde quieres llevar tu sistema." },
  { title: "Objetivo corporal", description: "Calculamos el punto de partida y el objetivo real del plan." },
  { title: "Entrenamiento", description: "Adaptamos la rutina a tu experiencia, dias y contexto." },
  { title: "Nutricion real", description: "Ajustamos el plan a tus restricciones, gustos y presupuesto." },
  { title: "Estilo de vida", description: "Hacemos que el sistema se adapte a tu realidad y no al reves." },
  { title: "Ultimos detalles", description: "Cerramos lesiones, notas y dejamos todo listo para generar." },
];

type FormState = {
  activity_level: string;
  age: string;
  allergies: string;
  cooking_time: string;
  country: string;
  cuisine_style: string;
  dietary_restrictions: string;
  equipment: string;
  experience_level: string;
  full_name: string;
  gender: string;
  goal: string;
  height: string;
  injuries: string;
  preferred_foods: string;
  rejected_foods: string;
  target_weight: string;
  training_days: string;
  training_schedule: string;
  training_type: string;
  weight: string;
  food_budget: string;
};

const initialForm: FormState = {
  activity_level: "",
  age: "",
  allergies: "",
  cooking_time: "",
  country: "",
  cuisine_style: "",
  dietary_restrictions: "",
  equipment: "",
  experience_level: "",
  full_name: "",
  gender: "",
  goal: "",
  height: "",
  injuries: "",
  preferred_foods: "",
  rejected_foods: "",
  target_weight: "",
  training_days: "",
  training_schedule: "",
  training_type: "",
  weight: "",
  food_budget: "",
};

function parseListInput(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifyListInput(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value.map((item) => String(item)).join(", ");
}

export default function OnboardingForm() {
  const navigate = useNavigate();
  const { loading: authLoading, user } = useAuth();
  const { hasActiveSubscription } = useAccessStatus();
  const [form, setForm] = useState<FormState>(initialForm);
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const currentStep = stepTitles[stepIndex];
  const progressValue = useMemo(() => ((stepIndex + 1) / stepTitles.length) * 100, [stepIndex]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    const loadProfile = async () => {
      const [profileResult, answersResult] = await Promise.all([
        supabase
          .from("fitness_profiles" as any)
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("onboarding_answers" as any)
          .select("payload")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (profileResult.error) {
        console.error("Error cargando fitness_profiles", profileResult.error);
      }

      if (answersResult.error) {
        console.error("Error cargando onboarding_answers", answersResult.error);
      }

      const profile = (profileResult.data as Record<string, unknown> | null) ?? null;
      const answers = ((answersResult.data as { payload?: Record<string, unknown> } | null)?.payload ?? {}) as Record<string, unknown>;

      setForm({
        activity_level: String(profile?.activity_level ?? ""),
        age: profile?.age != null ? String(profile.age) : "",
        allergies: String(profile?.allergies ?? answers.allergies ?? ""),
        cooking_time: String(profile?.cooking_time ?? answers.cooking_time ?? ""),
        country: String(profile?.country ?? answers.country ?? ""),
        cuisine_style: String(profile?.cuisine_style ?? answers.cuisine_style ?? ""),
        dietary_restrictions: stringifyListInput(profile?.dietary_restrictions ?? answers.dietary_restrictions),
        equipment: stringifyListInput(profile?.equipment ?? answers.equipment),
        experience_level: String(profile?.experience_level ?? answers.experience_level ?? ""),
        full_name: String(profile?.full_name ?? user.user_metadata?.name ?? ""),
        gender: String(profile?.gender ?? ""),
        goal: String(profile?.goal ?? ""),
        height: profile?.height != null ? String(profile.height) : "",
        injuries: String(profile?.injuries ?? answers.injuries ?? ""),
        preferred_foods: stringifyListInput(profile?.preferred_foods ?? answers.preferred_foods),
        rejected_foods: stringifyListInput(profile?.rejected_foods ?? answers.rejected_foods),
        target_weight: profile?.target_weight != null ? String(profile.target_weight) : "",
        training_days: profile?.training_days != null ? String(profile.training_days) : "",
        training_schedule: String(answers.training_schedule ?? ""),
        training_type: String(profile?.training_type ?? answers.training_type ?? ""),
        weight: profile?.weight != null ? String(profile.weight) : "",
        food_budget: String(profile?.food_budget ?? answers.food_budget ?? ""),
      });

      setLoadingProfile(false);
    };

    void loadProfile();
  }, [authLoading, navigate, user]);

  const update = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validateStep = () => {
    const requiredByStep: Array<Array<keyof FormState>> = [
      ["full_name", "gender", "age"],
      ["height", "weight", "target_weight", "goal"],
      ["activity_level", "experience_level", "training_days", "training_type"],
      [],
      ["food_budget", "cooking_time", "country", "cuisine_style"],
      [],
    ];

    const missingField = requiredByStep[stepIndex].find((field) => !form[field].trim());

    if (!missingField) return true;

    toast({
      title: "Completa este paso",
      description: "Necesitamos estos datos para que el sistema se sienta realmente personalizado.",
      variant: "destructive",
    });
    return false;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStepIndex((current) => Math.min(current + 1, stepTitles.length - 1));
  };

  const handleBack = () => {
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateStep()) return;

    const currentUser = user ?? (await supabase.auth.getUser()).data.user;
    if (!currentUser) {
      toast({ title: "Debes iniciar sesion", variant: "destructive" });
      navigate("/login", { replace: true });
      return;
    }

    setLoading(true);

    const fitnessPayload = {
      user_id: currentUser.id,
      full_name: form.full_name.trim(),
      weight: Number(form.weight),
      height: Number(form.height),
      age: Number(form.age),
      gender: form.gender,
      goal: form.goal,
      activity_level: form.activity_level,
      training_days: Number(form.training_days),
      target_weight: Number(form.target_weight),
      experience_level: form.experience_level,
      training_type: form.training_type,
      equipment: parseListInput(form.equipment),
      dietary_restrictions: parseListInput(form.dietary_restrictions),
      allergies: form.allergies.trim() || null,
      preferred_foods: parseListInput(form.preferred_foods),
      rejected_foods: parseListInput(form.rejected_foods),
      food_budget: form.food_budget,
      cooking_time: form.cooking_time,
      country: form.country.trim(),
      cuisine_style: form.cuisine_style.trim(),
      injuries: form.injuries.trim() || null,
      onboarding_completed: true,
    };

    const onboardingPayload = {
      user_id: currentUser.id,
      payload: {
        training_schedule: form.training_schedule.trim(),
        equipment: parseListInput(form.equipment),
        dietary_restrictions: parseListInput(form.dietary_restrictions),
        preferred_foods: parseListInput(form.preferred_foods),
        rejected_foods: parseListInput(form.rejected_foods),
        allergies: form.allergies.trim(),
        injuries: form.injuries.trim(),
        cooking_time: form.cooking_time,
        country: form.country.trim(),
        cuisine_style: form.cuisine_style.trim(),
        food_budget: form.food_budget,
        experience_level: form.experience_level,
        training_type: form.training_type,
      },
    };

    const [profileResult, answersResult] = await Promise.all([
      supabase
        .from("fitness_profiles" as any)
        .upsert(fitnessPayload as any, { onConflict: "user_id" }),
      supabase
        .from("onboarding_answers" as any)
        .upsert(onboardingPayload as any, { onConflict: "user_id" }),
    ]);

    setLoading(false);

    if (profileResult.error || answersResult.error) {
      console.error("Error guardando onboarding premium", {
        answersError: answersResult.error,
        profileError: profileResult.error,
      });
      toast({
        title: "No se pudo guardar tu sistema",
        description: profileResult.error?.message ?? answersResult.error?.message ?? "Error inesperado",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Estamos creando tu sistema personalizado",
      description: hasActiveSubscription
        ? "Tu perfil premium ya quedo listo para seguir en el dashboard."
        : "Tu perfil premium ya quedo listo. Solo falta activar tu acceso.",
    });

    navigate(hasActiveSubscription ? "/dashboard" : "/suscripcion", { replace: true });
  };

  if (authLoading || loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen section-padding py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-center gap-2 font-display text-xl font-bold tracking-tight">
          <Dumbbell className="h-6 w-6 text-primary" />
          <span>FIT AI</span>
          <span className="text-primary">SYSTEM</span>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
          <div className="glass-card rounded-3xl p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              Onboarding premium obligatorio
            </div>

            <h1 className="mt-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Crea tu sistema inteligente de progreso
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              No vamos a darte una dieta generica. Vamos a construir un sistema que se adapte a tu cuerpo, tu ritmo y tu contexto real.
            </p>

            <div className="mt-8 rounded-2xl border border-border/60 bg-background/20 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Paso {stepIndex + 1} de {stepTitles.length}</div>
                  <div className="mt-2 font-display text-2xl font-bold">{currentStep.title}</div>
                </div>
                <div className="text-sm text-muted-foreground">{Math.round(progressValue)}%</div>
              </div>
              <Progress className="mt-4" value={progressValue} />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{currentStep.description}</p>
            </div>

            <div className="mt-6 space-y-3">
              {[
                "Plan nutricional y entrenamiento realmente personalizados",
                "Ajustes semanales segun progreso y adherencia",
                "Sistema pensado para que pagar y renovar tenga sentido",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-border/60 bg-background/20 p-4 text-sm text-foreground/90">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-3xl p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {stepIndex === 0 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nombre</Label>
                    <Input id="full_name" value={form.full_name} onChange={(event) => update("full_name", event.target.value)} placeholder="Como quieres que te llamemos?" className="bg-background/50" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Sexo</Label>
                      <Select value={form.gender} onValueChange={(value) => update("gender", value)}>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {sexOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age">Edad</Label>
                      <Input id="age" type="number" value={form.age} onChange={(event) => update("age", event.target.value)} placeholder="28" className="bg-background/50" />
                    </div>
                  </div>
                </div>
              )}

              {stepIndex === 1 && (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="weight">Peso actual (kg)</Label>
                      <Input id="weight" type="number" value={form.weight} onChange={(event) => update("weight", event.target.value)} placeholder="75" className="bg-background/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="target_weight">Peso objetivo (kg)</Label>
                      <Input id="target_weight" type="number" value={form.target_weight} onChange={(event) => update("target_weight", event.target.value)} placeholder="70" className="bg-background/50" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="height">Altura (cm)</Label>
                      <Input id="height" type="number" value={form.height} onChange={(event) => update("height", event.target.value)} placeholder="175" className="bg-background/50" />
                    </div>
                    <div className="space-y-2">
                      <Label>Objetivo</Label>
                      <Select value={form.goal} onValueChange={(value) => update("goal", value)}>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Seleccionar objetivo" />
                        </SelectTrigger>
                        <SelectContent>
                          {goalOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {stepIndex === 2 && (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nivel de actividad</Label>
                      <Select value={form.activity_level} onValueChange={(value) => update("activity_level", value)}>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {activityOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Experiencia entrenando</Label>
                      <Select value={form.experience_level} onValueChange={(value) => update("experience_level", value)}>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {experienceOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Dias disponibles</Label>
                      <Select value={form.training_days} onValueChange={(value) => update("training_days", value)}>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {[2, 3, 4, 5, 6, 7].map((days) => (
                            <SelectItem key={days} value={String(days)}>{days} dias</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de entrenamiento</Label>
                      <Select value={form.training_type} onValueChange={(value) => update("training_type", value)}>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {trainingTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="equipment">Equipamiento disponible</Label>
                    <Textarea id="equipment" value={form.equipment} onChange={(event) => update("equipment", event.target.value)} placeholder="Ej: barra, mancuernas, banco, bandas, caminadora" className="bg-background/50" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="training_schedule">Dias y horarios disponibles</Label>
                    <Textarea id="training_schedule" value={form.training_schedule} onChange={(event) => update("training_schedule", event.target.value)} placeholder="Ej: lunes, miercoles y viernes por la noche" className="bg-background/50" />
                  </div>
                </div>
              )}

              {stepIndex === 3 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="dietary_restrictions">Restricciones alimentarias</Label>
                    <Textarea id="dietary_restrictions" value={form.dietary_restrictions} onChange={(event) => update("dietary_restrictions", event.target.value)} placeholder="Ej: vegetariano, sin lactosa, sin gluten" className="bg-background/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="allergies">Alergias</Label>
                    <Textarea id="allergies" value={form.allergies} onChange={(event) => update("allergies", event.target.value)} placeholder="Ej: frutos secos, mariscos" className="bg-background/50" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="preferred_foods">Alimentos preferidos</Label>
                      <Textarea id="preferred_foods" value={form.preferred_foods} onChange={(event) => update("preferred_foods", event.target.value)} placeholder="Ej: pollo, arroz, huevos, avena" className="bg-background/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rejected_foods">Alimentos rechazados</Label>
                      <Textarea id="rejected_foods" value={form.rejected_foods} onChange={(event) => update("rejected_foods", event.target.value)} placeholder="Ej: atun, brocoli, higado" className="bg-background/50" />
                    </div>
                  </div>
                </div>
              )}

              {stepIndex === 4 && (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Presupuesto alimenticio</Label>
                      <Select value={form.food_budget} onValueChange={(value) => update("food_budget", value)}>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {budgetOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tiempo para cocinar</Label>
                      <Select value={form.cooking_time} onValueChange={(value) => update("cooking_time", value)}>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {cookingTimeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="country">Pais</Label>
                      <Input id="country" value={form.country} onChange={(event) => update("country", event.target.value)} placeholder="Ej: Argentina" className="bg-background/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cuisine_style">Estilo de comida</Label>
                      <Input id="cuisine_style" value={form.cuisine_style} onChange={(event) => update("cuisine_style", event.target.value)} placeholder="Ej: casera, argentina, rapida" className="bg-background/50" />
                    </div>
                  </div>
                </div>
              )}

              {stepIndex === 5 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="injuries">Lesiones o limitaciones</Label>
                    <Textarea id="injuries" value={form.injuries} onChange={(event) => update("injuries", event.target.value)} placeholder="Ej: dolor de rodilla, hombro sensible, lumbalgia" className="bg-background/50" />
                  </div>

                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                    <div className="text-sm font-semibold text-primary">Estamos creando tu plan personalizado</div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Cuando confirmes, guardaremos tu perfil premium y activaremos el paso final para convertirlo en tu sistema personalizado.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="ghost" onClick={handleBack} disabled={stepIndex === 0 || loading}>
                  Volver
                </Button>

                <div className="flex flex-col gap-3 sm:flex-row">
                  {stepIndex < stepTitles.length - 1 ? (
                    <Button type="button" variant="hero" onClick={handleNext}>
                      Continuar
                    </Button>
                  ) : (
                    <Button type="submit" variant="hero" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Estamos creando tu plan personalizado
                        </>
                      ) : "Guardar y continuar"}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
