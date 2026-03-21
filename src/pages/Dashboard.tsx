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
type DashboardTab = PlanType | "ejercicios";

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

type ExerciseIllustration = "squat" | "lunge" | "row" | "bike" | "bench" | "hinge" | "pull" | "carry";

type ExerciseCard = {
  cadence: string;
  focus: string;
  illustration: ExerciseIllustration;
  name: string;
  reason: string;
  rest: string;
  sets: string;
  steps: string[];
};

type ExerciseDayPlan = {
  dayLabel: string;
  durationMinutes: number;
  exercises: ExerciseCard[];
  focus: string;
  intensity: string;
  objective: string;
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

const edgeFunctionsUrl = import.meta.env.VITE_SUPABASE_URL;
const edgeFunctionsKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

const exerciseProgramsByGoal: Record<string, ExerciseDayPlan[]> = {
  bajar_grasa: [
    {
      dayLabel: "Dia 1",
      durationMinutes: 32,
      focus: "Piernas + gasto calorico",
      intensity: "Media / alta",
      objective: "Subir pulsaciones mientras cuidas masa muscular",
      exercises: [
        {
          name: "Sentadilla goblet",
          focus: "Piernas + core",
          illustration: "squat",
          cadence: "12 reps controladas",
          sets: "4 series",
          rest: "60 segundos",
          reason: "Mueve mucho musculo y sostiene tecnica incluso en deficit.",
          steps: [
            "Sosten la mancuerna pegada al pecho con codos cerrados.",
            "Baja la cadera hacia atras manteniendo el pecho alto.",
            "Empuja el piso con todo el pie para volver arriba.",
          ],
        },
        {
          name: "Zancadas caminando",
          focus: "Pierna unilateral",
          illustration: "lunge",
          cadence: "10 pasos por lado",
          sets: "3 series",
          rest: "45 segundos",
          reason: "Eleva exigencia cardiovascular sin perder trabajo de fuerza real.",
          steps: [
            "Da un paso largo y apoya primero el talon.",
            "Baja ambas rodillas hasta rozar el piso sin colapsar el tronco.",
            "Empuja con la pierna delantera y cambia de lado de forma fluida.",
          ],
        },
        {
          name: "Intervalos en bici",
          focus: "Condicionamiento",
          illustration: "bike",
          cadence: "30 s rapido / 30 s suave",
          sets: "10 rondas",
          rest: "Sin pausa extra",
          reason: "Aumenta gasto sin destruir tu recuperacion de fuerza.",
          steps: [
            "Arranca con ritmo suave para tomar cadencia.",
            "Acelera fuerte durante 30 segundos sin perder postura.",
            "Afloja 30 segundos y repite manteniendo respiracion controlada.",
          ],
        },
      ],
    },
    {
      dayLabel: "Dia 2",
      durationMinutes: 28,
      focus: "Espalda + postura activa",
      intensity: "Media",
      objective: "Mantener musculo arriba mientras bajas grasa",
      exercises: [
        {
          name: "Remo con mancuerna",
          focus: "Espalda media",
          illustration: "row",
          cadence: "12 reps por brazo",
          sets: "4 series",
          rest: "45 segundos",
          reason: "Ayuda a mantener masa muscular y mejorar postura.",
          steps: [
            "Apoya una mano en banco o muslo y crea una espalda larga.",
            "Lleva el codo hacia la cadera sin girar el torso.",
            "Baja controlando el peso sin perder tension.",
          ],
        },
        {
          name: "Farmer walk",
          focus: "Core + agarre",
          illustration: "carry",
          cadence: "40 metros",
          sets: "4 pasadas",
          rest: "40 segundos",
          reason: "Da trabajo util y eleva el gasto con poco impacto.",
          steps: [
            "Sujeta las cargas a los lados con hombros abajo.",
            "Camina corto y firme manteniendo abdomen duro.",
            "No balancees el cuerpo ni dejes caer el pecho.",
          ],
        },
        {
          name: "Sentadilla goblet ligera",
          focus: "Acabado metabolico",
          illustration: "squat",
          cadence: "15 reps",
          sets: "2 series",
          rest: "30 segundos",
          reason: "Cierra la sesion con mas trabajo sin complicar tecnica.",
          steps: [
            "Respira antes de bajar y mantente estable.",
            "Busca profundidad comoda sin despegar talones.",
            "Sube con ritmo continuo, sin rebotes.",
          ],
        },
      ],
    },
  ],
  ganar_musculo: [
    {
      dayLabel: "Dia 1",
      durationMinutes: 42,
      focus: "Piernas pesadas",
      intensity: "Alta",
      objective: "Crear base de masa muscular real en tren inferior",
      exercises: [
        {
          name: "Sentadilla trasera",
          focus: "Base de masa muscular",
          illustration: "squat",
          cadence: "6 a 8 reps",
          sets: "4 series",
          rest: "90 segundos",
          reason: "Es de los ejercicios con mas retorno para piernas y gluteos.",
          steps: [
            "Apoya la barra firme sobre la parte alta de la espalda.",
            "Rompe con cadera y rodillas al mismo tiempo manteniendo pecho alto.",
            "Sube empujando con todo el pie y rodillas alineadas.",
          ],
        },
        {
          name: "Peso muerto rumano",
          focus: "Femoral + gluteo",
          illustration: "hinge",
          cadence: "8 a 10 reps",
          sets: "4 series",
          rest: "75 segundos",
          reason: "Suma masa atras de la pierna y mejora la bisagra.",
          steps: [
            "Empieza de pie con la barra pegada al cuerpo.",
            "Lleva la cadera hacia atras con rodillas apenas flexionadas.",
            "Sube apretando gluteos sin arquear la espalda.",
          ],
        },
        {
          name: "Zancadas caminando",
          focus: "Volumen extra",
          illustration: "lunge",
          cadence: "12 pasos por lado",
          sets: "3 series",
          rest: "60 segundos",
          reason: "Aporta mas estimulo sin repetir el mismo patron pesado.",
          steps: [
            "Da pasos amplios para cargar gluteos y cuadriceps.",
            "Mantente erguido mientras bajas con control.",
            "Empuja el piso fuerte para salir de cada paso.",
          ],
        },
      ],
    },
    {
      dayLabel: "Dia 2",
      durationMinutes: 38,
      focus: "Empuje de torso",
      intensity: "Media / alta",
      objective: "Subir fuerza y volumen en pecho y triceps",
      exercises: [
        {
          name: "Press banca",
          focus: "Pecho + triceps",
          illustration: "bench",
          cadence: "6 a 8 reps",
          sets: "4 series",
          rest: "90 segundos",
          reason: "Permite progresar cargas y medir avance mes a mes.",
          steps: [
            "Acomoda escapulas atras y pies firmes en el suelo.",
            "Baja la barra al pecho con antebrazos verticales.",
            "Empuja en linea recta sin despegar gluteos del banco.",
          ],
        },
        {
          name: "Press inclinado",
          focus: "Pecho superior",
          illustration: "bench",
          cadence: "8 a 10 reps",
          sets: "3 series",
          rest: "75 segundos",
          reason: "Completa el trabajo de empuje con mejor angulo para torso alto.",
          steps: [
            "Ajusta el banco con inclinacion moderada.",
            "Baja con control hasta linea del pecho alto.",
            "Sube cerrando fuerte el pecho sin rebotar.",
          ],
        },
        {
          name: "Farmer walk",
          focus: "Estabilidad total",
          illustration: "carry",
          cadence: "30 metros",
          sets: "3 pasadas",
          rest: "45 segundos",
          reason: "Suma trabajo de agarre y core para sostener mejores cargas.",
          steps: [
            "Toma las mancuernas con hombros atras.",
            "Camina firme y corto sin inclinarte.",
            "Mantente alto hasta el final de la pasada.",
          ],
        },
      ],
    },
    {
      dayLabel: "Dia 3",
      durationMinutes: 40,
      focus: "Espalda densa",
      intensity: "Media / alta",
      objective: "Dar espesor al torso y equilibrar el empuje",
      exercises: [
        {
          name: "Remo con barra",
          focus: "Espalda densa",
          illustration: "row",
          cadence: "8 a 10 reps",
          sets: "4 series",
          rest: "75 segundos",
          reason: "Compensa empuje y mejora la apariencia global del torso.",
          steps: [
            "Inclina el tronco con espalda neutra y barra cerca del cuerpo.",
            "Lleva los codos atras sin encoger hombros.",
            "Desciende controlado manteniendo abdomen firme.",
          ],
        },
        {
          name: "Dominadas asistidas",
          focus: "Espalda funcional",
          illustration: "pull",
          cadence: "6 a 8 reps",
          sets: "4 series",
          rest: "75 segundos",
          reason: "Construye espalda y mejora control corporal.",
          steps: [
            "Agarra la barra con manos apenas mas abiertas que hombros.",
            "Tira llevando el pecho hacia arriba antes que la barbilla.",
            "Baja lento hasta estirar sin perder tension.",
          ],
        },
        {
          name: "Peso muerto rumano ligero",
          focus: "Recordatorio de bisagra",
          illustration: "hinge",
          cadence: "12 reps",
          sets: "2 series",
          rest: "45 segundos",
          reason: "Refuerza la cadena posterior sin agotar demasiado.",
          steps: [
            "Mantente largo desde cabeza a cadera.",
            "Lleva la barra rozando muslos y espinillas.",
            "Sube apretando gluteos con control.",
          ],
        },
      ],
    },
  ],
  mantener: [
    {
      dayLabel: "Dia 1",
      durationMinutes: 30,
      focus: "Torso + estabilidad",
      intensity: "Media",
      objective: "Mantener fuerza util sin exceso de fatiga",
      exercises: [
        {
          name: "Press inclinado",
          focus: "Torso superior",
          illustration: "bench",
          cadence: "8 a 10 reps",
          sets: "3 series",
          rest: "60 segundos",
          reason: "Mantiene musculatura y calidad de empuje con carga moderada.",
          steps: [
            "Escapulas atras y pies firmes antes de empezar.",
            "Baja parejo hasta el pecho alto.",
            "Empuja sin perder control del banco.",
          ],
        },
        {
          name: "Dominadas asistidas",
          focus: "Espalda funcional",
          illustration: "pull",
          cadence: "8 reps",
          sets: "3 series",
          rest: "60 segundos",
          reason: "Mantiene la espalda activa y estable con volumen controlado.",
          steps: [
            "Inicia con abdomen firme y hombros abajo.",
            "Tira con codos hacia costillas.",
            "Desciende lento para aprovechar cada repeticion.",
          ],
        },
        {
          name: "Farmer walk",
          focus: "Core + agarre",
          illustration: "carry",
          cadence: "35 metros",
          sets: "3 pasadas",
          rest: "40 segundos",
          reason: "Da condicion fisica util y sensacion atletica real.",
          steps: [
            "Carga fuerte pero con postura alta.",
            "Camina sin balancearte ni acelerar de mas.",
            "Respira corto y manten abdomen activo.",
          ],
        },
      ],
    },
    {
      dayLabel: "Dia 2",
      durationMinutes: 28,
      focus: "Piernas tecnicas",
      intensity: "Media",
      objective: "Sostener calidad de movimiento y fuerza base",
      exercises: [
        {
          name: "Sentadilla frontal",
          focus: "Piernas + core",
          illustration: "squat",
          cadence: "6 a 8 reps",
          sets: "3 series",
          rest: "75 segundos",
          reason: "Mantiene fuerza y tecnica con menos desgaste total.",
          steps: [
            "Mantene codos altos y torso largo.",
            "Baja con control sin colapsar el pecho.",
            "Sube apretando abdomen y empujando con todo el pie.",
          ],
        },
        {
          name: "Remo con mancuerna",
          focus: "Postura",
          illustration: "row",
          cadence: "10 reps por brazo",
          sets: "3 series",
          rest: "45 segundos",
          reason: "Compensa el dia y mantiene la espalda activa.",
          steps: [
            "Busca una base firme y espalda neutra.",
            "Tira con el codo hacia atras.",
            "Baja lento para sentir bien el dorsal.",
          ],
        },
        {
          name: "Zancadas caminando",
          focus: "Estabilidad",
          illustration: "lunge",
          cadence: "10 pasos por lado",
          sets: "2 series",
          rest: "45 segundos",
          reason: "Mantiene coordinacion y trabajo unilateral sin exceso.",
          steps: [
            "Da un paso largo y cae controlado.",
            "Alinea rodilla y punta del pie.",
            "Sube estable y sigue caminando.",
          ],
        },
      ],
    },
  ],
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

function goalLabel(goal: string | null | undefined) {
  switch (goal) {
    case "bajar_grasa":
      return "bajar grasa";
    case "ganar_musculo":
      return "ganar musculo";
    default:
      return "mantenerte en forma";
  }
}

function getExerciseProgram(goal: string | null | undefined) {
  if (!goal) {
    return exerciseProgramsByGoal.mantener;
  }

  return exerciseProgramsByGoal[goal] ?? exerciseProgramsByGoal.mantener;
}

function formatTimer(seconds: number | null) {
  if (seconds == null) return "--:--";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function ExerciseStage({
  caption,
  children,
  title,
}: {
  caption: string;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{title}</div>
      <div className="mt-2">{children}</div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{caption}</p>
    </div>
  );
}

function ExerciseCanvas({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <svg viewBox="0 0 220 140" aria-label={label} className="h-28 w-full text-primary">
      <title>{label}</title>
      {children}
    </svg>
  );
}

function ExerciseDemo({ label, variant }: { label: string; variant: ExerciseIllustration }) {
  const line = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 5,
  };
  const softLine = { ...line, opacity: 0.35 };
  const arrow = { ...line, opacity: 0.75 };

  switch (variant) {
    case "bench":
      return (
        <div className="grid gap-3 lg:grid-cols-2">
          <ExerciseStage title="Inicio" caption="Barra arriba, escapulas atras y pies firmes en el suelo.">
            <ExerciseCanvas label={`${label} inicio`}>
              <path {...line} d="M22 96h168M50 96V74h70v22" />
              <circle {...line} cx="78" cy="50" r="10" />
              <path {...line} d="M88 58h36m-18 0v18m-34 20 10-20 24-18m0 0 24 18 8 20" />
              <path {...line} d="M88 42h68" />
              <path {...arrow} d="M146 30h26m-10-10 10 10-10 10" />
            </ExerciseCanvas>
          </ExerciseStage>
          <ExerciseStage title="Final" caption="Baja la barra al pecho con antebrazos rectos y vuelve a empujar.">
            <ExerciseCanvas label={`${label} final`}>
              <path {...line} d="M22 96h168M50 96V74h70v22" />
              <circle {...line} cx="78" cy="50" r="10" />
              <path {...line} d="M88 58h36m-18 0v18m-34 20 10-20 24-18m0 0 24 18 8 20" />
              <path {...line} d="M74 66h78" />
              <path {...arrow} d="M164 34v24m0 0-8-8m8 8 8-8" />
            </ExerciseCanvas>
          </ExerciseStage>
        </div>
      );
    case "hinge":
      return (
        <div className="grid gap-3 lg:grid-cols-2">
          <ExerciseStage title="Inicio" caption="De pie, barra pegada a muslos y pecho abierto.">
            <ExerciseCanvas label={`${label} inicio`}>
              <circle {...line} cx="94" cy="24" r="10" />
              <path {...line} d="M94 34v34m0 0-20 18m20-18 20 18m-32-30H56m50 0h24M56 112h76" />
            </ExerciseCanvas>
          </ExerciseStage>
          <ExerciseStage title="Final" caption="Lleva la cadera atras y baja la barra rozando piernas sin curvar espalda.">
            <ExerciseCanvas label={`${label} final`}>
              <circle {...line} cx="86" cy="26" r="10" />
              <path {...line} d="M86 36v24l34 8m-34-8-22 24m22-24-24 10m58-2 12 28m-30-10 18-18" />
              <path {...line} d="M54 108h88" />
              <path {...arrow} d="M142 24c10 16 10 40 0 58" />
            </ExerciseCanvas>
          </ExerciseStage>
        </div>
      );
    case "pull":
      return (
        <div className="grid gap-3 lg:grid-cols-2">
          <ExerciseStage title="Inicio" caption="Cuelga con brazos estirados y hombros abajo.">
            <ExerciseCanvas label={`${label} inicio`}>
              <path {...line} d="M46 18h128" />
              <circle {...line} cx="110" cy="54" r="10" />
              <path {...line} d="M82 18v26m56-26v26M98 64v24m24-24v24M110 64v20m0 0-18 18m18-18 18 18m-18 0-10 24m10-24 10 24" />
            </ExerciseCanvas>
          </ExerciseStage>
          <ExerciseStage title="Final" caption="Tira con codos hacia abajo hasta acercar pecho a la barra.">
            <ExerciseCanvas label={`${label} final`}>
              <path {...line} d="M46 18h128" />
              <circle {...line} cx="110" cy="36" r="10" />
              <path {...line} d="M82 18v12m56-12v12M100 46v22m20-22v22M110 46v16m0 0-18 18m18-18 18 18m-18 0-10 24m10-24 10 24" />
              <path {...arrow} d="M158 62c-10 8-26 12-42 12" />
            </ExerciseCanvas>
          </ExerciseStage>
        </div>
      );
    case "carry":
      return (
        <div className="grid gap-3 lg:grid-cols-2">
          <ExerciseStage title="Postura" caption="Camina alto, abdomen firme y hombros lejos de las orejas.">
            <ExerciseCanvas label={`${label} postura`}>
              <circle {...line} cx="110" cy="28" r="10" />
              <path {...line} d="M110 38v34m0 0-20 18m20-18 20 18m-28-24H78m40 0h24M78 66v36m64-36v36M66 102h24m40 0h24" />
            </ExerciseCanvas>
          </ExerciseStage>
          <ExerciseStage title="Movimiento" caption="Da pasos cortos y firmes sin balancearte hacia los lados.">
            <ExerciseCanvas label={`${label} movimiento`}>
              <circle {...line} cx="104" cy="28" r="10" />
              <path {...line} d="M104 38v34m0 0-18 16m18-16 22 18m-26-22H78m40 0h24M78 68v34m64-34v34M66 102h24m40 0h24" />
              <path {...arrow} d="M42 40h-18m0 0 10-8m-10 8 10 8M164 40h18m0 0-10-8m10 8-10 8" />
            </ExerciseCanvas>
          </ExerciseStage>
        </div>
      );
    case "row":
      return (
        <div className="grid gap-3 lg:grid-cols-2">
          <ExerciseStage title="Inicio" caption="Torso inclinado, espalda neutra y barra colgando debajo del pecho.">
            <ExerciseCanvas label={`${label} inicio`}>
              <circle {...line} cx="80" cy="26" r="10" />
              <path {...line} d="M80 36l22 24 40 6m-40-6-24 24m24-24-30 8m72 0h22M48 112h110" />
            </ExerciseCanvas>
          </ExerciseStage>
          <ExerciseStage title="Final" caption="Lleva codos atras hasta tocar la barra cerca del abdomen.">
            <ExerciseCanvas label={`${label} final`}>
              <circle {...line} cx="80" cy="26" r="10" />
              <path {...line} d="M80 36l22 24 34 2m-34-2-24 24m24-24-30 8m36-6h34" />
              <path {...arrow} d="M152 60h24m-8-8 8 8-8 8" />
              <path {...softLine} d="M48 112h110" />
            </ExerciseCanvas>
          </ExerciseStage>
        </div>
      );
    case "bike":
      return (
        <div className="grid gap-3 lg:grid-cols-2">
          <ExerciseStage title="Ritmo suave" caption="Pedalea controlado para entrar en calor y encontrar cadencia.">
            <ExerciseCanvas label={`${label} suave`}>
              <circle {...line} cx="62" cy="98" r="20" />
              <circle {...line} cx="142" cy="98" r="20" />
              <path {...line} d="M62 98l30-30 24 30H62m30-30h26m-12 0-12-18m28 18 16-14" />
              <path {...line} d="M104 40h16m-8 0v28m0 0-22 12" />
            </ExerciseCanvas>
          </ExerciseStage>
          <ExerciseStage title="Ritmo fuerte" caption="Acelera durante el bloque intenso sin perder postura ni control.">
            <ExerciseCanvas label={`${label} fuerte`}>
              <circle {...line} cx="62" cy="98" r="20" />
              <circle {...line} cx="142" cy="98" r="20" />
              <path {...line} d="M62 98l30-30 24 30H62m30-30h26m-12 0-12-18m28 18 16-14" />
              <path {...line} d="M104 40h16m-8 0v28m0 0-22 12" />
              <path {...arrow} d="M170 36c12 12 14 30 2 46" />
            </ExerciseCanvas>
          </ExerciseStage>
        </div>
      );
    case "lunge":
      return (
        <div className="grid gap-3 lg:grid-cols-2">
          <ExerciseStage title="Inicio" caption="Da un paso amplio y mantente erguido antes de bajar.">
            <ExerciseCanvas label={`${label} inicio`}>
              <circle {...line} cx="90" cy="24" r="10" />
              <path {...line} d="M90 34v30m0 0-22 20m22-20 24 18m-26-20-22 10m46 8 36 6" />
              <path {...softLine} d="M38 112h138" />
            </ExerciseCanvas>
          </ExerciseStage>
          <ExerciseStage title="Final" caption="Baja ambas rodillas con control y empuja el suelo para volver arriba.">
            <ExerciseCanvas label={`${label} final`}>
              <circle {...line} cx="90" cy="24" r="10" />
              <path {...line} d="M90 34v28l24 18m-24-18-18 26m18-26-24 10m48 8 34 6m-24 0-8 26m-24 0 12-26" />
              <path {...arrow} d="M176 50v28m0 0-8-8m8 8 8-8" />
              <path {...softLine} d="M38 112h138" />
            </ExerciseCanvas>
          </ExerciseStage>
        </div>
      );
    case "squat":
    default:
      return (
        <div className="grid gap-3 lg:grid-cols-2">
          <ExerciseStage title="Inicio" caption="Pies firmes, pecho alto y barra estable sobre la espalda.">
            <ExerciseCanvas label={`${label} inicio`}>
              <circle {...line} cx="94" cy="24" r="10" />
              <path {...line} d="M54 42h80m-40 0v26m0 0-20 18m20-18 22 18m-24-20-22-8m22 8 18-8m-40 44 18-24m22 0 18 24" />
              <path {...softLine} d="M48 112h92" />
            </ExerciseCanvas>
          </ExerciseStage>
          <ExerciseStage title="Final" caption="Cadera atras, rodillas alineadas y baja con control hasta la profundidad segura.">
            <ExerciseCanvas label={`${label} final`}>
              <circle {...line} cx="94" cy="22" r="10" />
              <path {...line} d="M54 40h80m-40 0v20l-16 12m16-12 20 14m-18-14-18-8m18 8 16-6m-38 50 18-22m18-2 18 24" />
              <path {...arrow} d="M164 34v28m0 0-8-8m8 8 8-8" />
              <path {...softLine} d="M48 112h92" />
            </ExerciseCanvas>
          </ExerciseStage>
        </div>
      );
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
  const [activeTab, setActiveTab] = useState<DashboardTab>("dieta");
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
  const [selectedExerciseDay, setSelectedExerciseDay] = useState(0);
  const [exerciseTimerRunning, setExerciseTimerRunning] = useState(false);
  const [exerciseSecondsLeft, setExerciseSecondsLeft] = useState<number | null>(null);

  const getFunctionAccessToken = async () => {
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

    return activeSession?.access_token ?? null;
  };

  const invokeEdgeFunction = async <T,>(functionName: string, body: unknown, accessToken: string) => {
    if (!edgeFunctionsUrl || !edgeFunctionsKey) {
      throw new Error("Supabase no esta configurado correctamente.");
    }

    const response = await fetch(`${edgeFunctionsUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: edgeFunctionsKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const rawResponse = await response.text();
    let parsedResponse: unknown = null;

    if (rawResponse) {
      try {
        parsedResponse = JSON.parse(rawResponse);
      } catch {
        parsedResponse = rawResponse;
      }
    }

    if (!response.ok) {
      console.error(`Error HTTP invocando ${functionName}`, {
        body: parsedResponse,
        status: response.status,
      });

      const message =
        parsedResponse && typeof parsedResponse === "object"
          ? "error" in parsedResponse && typeof parsedResponse.error === "string"
            ? parsedResponse.error
            : "message" in parsedResponse && typeof parsedResponse.message === "string"
              ? parsedResponse.message
              : null
          : null;

      throw new Error(message ?? `Edge Function returned ${response.status}`);
    }

    return parsedResponse as T;
  };

  const hasPremiumAccess = useMemo(() => isActiveSubscription(subscription), [subscription]);
  const activePlan = activeTab === "dieta" ? dietPlan : activeTab === "rutina" ? workoutPlan : null;
  const dailyTargets = useMemo(() => estimateDailyTargets(profile), [profile]);
  const exerciseProgram = useMemo(() => getExerciseProgram(profile?.goal), [profile?.goal]);
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
  const activeExerciseDay = exerciseProgram[selectedExerciseDay] ?? exerciseProgram[0] ?? null;
  const monthlyValueHooks = useMemo(() => [
    `Reajuste mensual para ${goalLabel(profile?.goal)} segun progreso real`,
    "Rotacion de ejercicios para evitar estancarte y mantener motivacion",
    dailyTargets ? `Objetivos diarios recalculados alrededor de ${formatNumber(dailyTargets.calories)} kcal` : "Objetivos diarios recalculados segun tu etapa actual",
    "Seguimiento nutricional, consultas y check-ins que justifican la renovacion",
  ], [dailyTargets, profile?.goal]);

  useEffect(() => {
    setSelectedExerciseDay(0);
  }, [profile?.goal]);

  useEffect(() => {
    if (!activeExerciseDay) {
      setExerciseTimerRunning(false);
      setExerciseSecondsLeft(null);
      return;
    }

    setExerciseTimerRunning(false);
    setExerciseSecondsLeft(activeExerciseDay.durationMinutes * 60);
  }, [activeExerciseDay]);

  useEffect(() => {
    if (activeTab !== "ejercicios") {
      setExerciseTimerRunning(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!exerciseTimerRunning || exerciseSecondsLeft == null) return;
    if (exerciseSecondsLeft <= 0) {
      setExerciseTimerRunning(false);
      return;
    }

    const timer = window.setInterval(() => {
      setExerciseSecondsLeft((current) => {
        if (current == null) return current;
        return Math.max(current - 1, 0);
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [exerciseSecondsLeft, exerciseTimerRunning]);

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
    const accessToken = await getFunctionAccessToken();
    if (!accessToken) {
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
      const generatedResponse = await invokeEdgeFunction<{ result?: unknown }>(
        "generate-plan",
        { planType },
        accessToken,
      );

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
    const accessToken = await getFunctionAccessToken();
    if (!accessToken) {
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
      const analysis = await invokeEdgeFunction<DailyNutritionAnalysis>(
        "analyze-meals",
        {
          meals,
          profile,
          targets: dailyTargets,
        },
        accessToken,
      );

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
    const accessToken = await getFunctionAccessToken();
    if (!accessToken) {
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

      const consultation = await invokeEdgeFunction<NutritionConsultation>(
        "ask-coach",
        {
          question: consultationQuestion,
          profile,
          contextSummary,
        },
        accessToken,
      );

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

  const handleToggleExerciseTimer = () => {
    if (!activeExerciseDay) return;

    if (exerciseTimerRunning) {
      setExerciseTimerRunning(false);
      return;
    }

    setExerciseSecondsLeft((current) => (
      current == null || current <= 0
        ? activeExerciseDay.durationMinutes * 60
        : current
    ));
    setExerciseTimerRunning(true);
  };

  const handleResetExerciseTimer = () => {
    if (!activeExerciseDay) return;
    setExerciseTimerRunning(false);
    setExerciseSecondsLeft(activeExerciseDay.durationMinutes * 60);
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

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Button variant={activeTab === "dieta" ? "default" : "secondary"} onClick={() => setActiveTab("dieta")} size="sm">
            <Utensils className="mr-1 h-4 w-4" />
            Plan de dieta
          </Button>
          <Button variant={activeTab === "rutina" ? "default" : "secondary"} onClick={() => setActiveTab("rutina")} size="sm">
            <Calendar className="mr-1 h-4 w-4" />
            Rutina semanal
          </Button>
          <Button
            variant={activeTab === "ejercicios" ? "default" : "secondary"}
            onClick={() => setActiveTab("ejercicios")}
            size="sm"
            disabled={!hasPremiumAccess}
          >
            <Bot className="mr-1 h-4 w-4" />
            Ejercicios IA premium
          </Button>
        </div>

        {hasPremiumAccess && activeTab === "ejercicios" && activeExerciseDay && (
          <div className="mb-8 grid gap-6 xl:grid-cols-[290px,1fr]">
            <div className="space-y-6">
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-primary/10 p-2">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold">Tu semana de ejercicios IA</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Recomendado para {goalLabel(profile?.goal)} con dias listos para ejecutar.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {exerciseProgram.map((day, index) => (
                    <button
                      key={day.dayLabel}
                      type="button"
                      onClick={() => setSelectedExerciseDay(index)}
                      className={`w-full rounded-xl border p-4 text-left transition ${selectedExerciseDay === index ? "border-primary/40 bg-primary/10 shadow-[0_0_0_1px_rgba(163,230,53,0.18)]" : "border-border/60 bg-background/20 hover:border-primary/20 hover:bg-background/30"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-display text-base font-semibold">{day.dayLabel}</span>
                        <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                          {day.durationMinutes} min
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-foreground/90">{day.focus}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{day.objective}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-primary/10 p-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold">Por que este premium se siente real</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cada mes cambia contigo, no se queda congelado.
                    </p>
                  </div>
                </div>

                <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
                  {monthlyValueHooks.map((item) => (
                    <li key={item} className="flex gap-3 rounded-xl border border-border/60 bg-background/20 p-4">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card rounded-2xl p-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {activeExerciseDay.dayLabel}
                      </span>
                      <span className="rounded-full border border-border/60 bg-background/30 px-3 py-1 text-xs font-semibold text-muted-foreground">
                        {activeExerciseDay.intensity}
                      </span>
                    </div>
                    <h2 className="mt-4 font-display text-2xl font-bold">{activeExerciseDay.focus}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {activeExerciseDay.objective}. Tu coach IA te deja el bloque listo para empezar ahora.
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Duracion</div>
                        <div className="mt-2 text-lg font-bold">{activeExerciseDay.durationMinutes} min</div>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ejercicios</div>
                        <div className="mt-2 text-lg font-bold">{activeExerciseDay.exercises.length}</div>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Meta</div>
                        <div className="mt-2 text-lg font-bold">{activeExerciseDay.intensity}</div>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-[260px] rounded-2xl border border-primary/20 bg-primary/5 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Temporizador</div>
                    <div className="mt-3 font-display text-5xl font-bold">{formatTimer(exerciseSecondsLeft)}</div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Tiempo objetivo para completar este bloque premium.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button variant="hero" onClick={handleToggleExerciseTimer}>
                        {exerciseTimerRunning ? "Pausar" : "Iniciar entrenamiento"}
                      </Button>
                      <Button variant="outline" onClick={handleResetExerciseTimer}>
                        Reiniciar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {activeExerciseDay.exercises.map((exercise) => (
                  <div key={`${activeExerciseDay.dayLabel}-${exercise.name}`} className="glass-card rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-xl font-bold">{exercise.name}</h3>
                        <p className="mt-1 text-sm font-medium text-foreground/90">{exercise.focus}</p>
                      </div>
                      <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {exercise.cadence}
                      </span>
                    </div>

                    <div className="mt-4 rounded-2xl border border-border/60 bg-background/20 p-4">
                      <ExerciseDemo label={exercise.name} variant={exercise.illustration} />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-border/60 bg-background/20 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Series</div>
                        <div className="mt-1 font-semibold">{exercise.sets}</div>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/20 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cadencia</div>
                        <div className="mt-1 font-semibold">{exercise.cadence}</div>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/20 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Descanso</div>
                        <div className="mt-1 font-semibold">{exercise.rest}</div>
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{exercise.reason}</p>

                    <div className="mt-4 rounded-xl border border-border/60 bg-background/20 p-4">
                      <div className="text-sm font-semibold text-foreground">Movimientos que debes hacer</div>
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {exercise.steps.map((step) => (
                          <li key={step} className="flex gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab !== "ejercicios" && (
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
                            disabled={!hasPremiumAccess || workoutSaving === section.title}
                            onClick={() => void handleToggleWorkoutDay(section.title)}
                          >
                            {workoutSaving === section.title ? "Guardando..." : workoutProgressRow?.completed ? "Hecho" : "Marcar"}
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
        )}
      </main>
    </div>
  );
}
