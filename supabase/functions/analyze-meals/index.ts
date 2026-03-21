import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { invokeGeminiJson } from "../_shared/gemini.ts";
import { requireUser } from "../_shared/supabase.ts";

type DailyMealInput = {
  almuerzo?: string;
  cena?: string;
  desayuno?: string;
  snacks?: string;
};

type FitnessProfile = {
  activity_level?: string | null;
  goal?: string | null;
  weight?: number | null;
};

type DailyTargets = {
  calories?: number;
  carbs?: number;
  fats?: number;
  protein?: number;
};

type MealAnalysis = {
  calories: number;
  carbs: number;
  fats: number;
  meal_type: string;
  protein: number;
  summary: string;
  text: string;
};

type DailyNutritionAnalysis = {
  coach_message: string;
  improve: string[];
  meals: MealAnalysis[];
  next_meal: string;
  strengths: string[];
  totals: {
    calories: number;
    carbs: number;
    fats: number;
    protein: number;
  };
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildPrompt(meals: DailyMealInput, profile: FitnessProfile | null, targets: DailyTargets | null) {
  const mealLines = Object.entries(meals)
    .map(([mealType, text]) => [mealType, cleanText(text)] as const)
    .filter(([, text]) => text)
    .map(([mealType, text]) => `${mealType}: ${text}`)
    .join("\n");

  const profileLines = [
    `Objetivo: ${profile?.goal ?? "sin dato"}`,
    `Peso: ${profile?.weight ?? "sin dato"} kg`,
    `Actividad: ${profile?.activity_level ?? "sin dato"}`,
    targets?.calories ? `Meta calorica diaria: ${targets.calories}` : "",
    targets?.protein ? `Meta de proteina diaria: ${targets.protein}` : "",
    targets?.carbs ? `Meta de carbohidratos diaria: ${targets.carbs}` : "",
    targets?.fats ? `Meta de grasas diaria: ${targets.fats}` : "",
  ].filter(Boolean).join("\n");

  return `Eres un nutricionista premium de una app fitness en espanol.

Perfil del usuario:
${profileLines}

Comidas registradas hoy:
${mealLines}

Responde SOLO con JSON valido con esta estructura:
{
  "totals": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fats": 0
  },
  "meals": [
    {
      "meal_type": "desayuno|almuerzo|cena|snacks",
      "text": "string",
      "summary": "string",
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fats": 0
    }
  ],
  "coach_message": "string",
  "strengths": ["string"],
  "improve": ["string"],
  "next_meal": "string"
}

Instrucciones:
- estima calorias y macros de forma razonable
- el tono debe sentirse premium, practico y realista
- explica que hizo bien el usuario
- explica que deberia ajustar
- sugiere la proxima comida recomendada
- no uses markdown, ni asteriscos, ni emojis`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireUser(req);

    const { meals, profile, targets } = await req.json() as {
      meals?: DailyMealInput;
      profile?: FitnessProfile | null;
      targets?: DailyTargets | null;
    };

    if (!meals || typeof meals !== "object") {
      throw new Error("Missing meals payload");
    }

    const hasMeals = Object.values(meals).some((value) => cleanText(value));
    if (!hasMeals) {
      throw new Error("No hay comidas para analizar");
    }

    const result = await invokeGeminiJson<DailyNutritionAnalysis>(
      buildPrompt(meals, profile ?? null, targets ?? null),
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-meals failed", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
