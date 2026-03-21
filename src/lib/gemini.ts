export type FitnessProfile = {
  activity_level: string | null;
  age: number | null;
  gender: string | null;
  goal: string | null;
  height: number | null;
  training_days: number | null;
  user_id: string;
  weight: number | null;
};

export type PremiumPlanSection = {
  bullets: string[];
  title: string;
};

export type PremiumPlan = {
  closing: string;
  coach_notes?: string[];
  highlights?: string[];
  intro: string;
  sections: PremiumPlanSection[];
  subtitle: string;
  title: string;
};

export type DailyMealInput = {
  almuerzo?: string;
  cena?: string;
  desayuno?: string;
  snacks?: string;
};

export type MealAnalysis = {
  calories: number;
  carbs: number;
  fats: number;
  meal_type: string;
  protein: number;
  summary: string;
  text: string;
};

export type DailyNutritionAnalysis = {
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

export type NutritionConsultation = {
  action_steps: string[];
  answer: string;
};

const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL ?? "gemini-2.5-flash";

console.log("frontend gemini loaded?", !!import.meta.env.VITE_GEMINI_API_KEY);

function ensureGeminiConfig() {
  if (!geminiKey) {
    throw new Error("Gemini no esta disponible para esta funcion premium en este momento.");
  }
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\*\*/g, "")
    .replace(/[`#_]/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/^[\-\u2022*\s]+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBullets(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean);
}

function splitTextIntoBullets(text: string) {
  return text
    .split(/\r?\n|\u2022|-/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function defaultTitle(planType: "dieta" | "rutina") {
  return planType === "dieta" ? "Plan de alimentacion personalizado" : "Plan de entrenamiento premium";
}

function defaultSubtitle(planType: "dieta" | "rutina") {
  return planType === "dieta" ? "Nutricion semanal premium" : "Rutina semanal personalizada";
}

function extractJsonText(rawText: string) {
  const trimmed = rawText.trim();

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function tryParseJsonString(raw: string) {
  const candidate = extractJsonText(raw);
  if (!candidate.startsWith("{") && !candidate.startsWith("[")) {
    return null;
  }

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

export function normalizePremiumPlan(content: unknown, planType: "dieta" | "rutina"): PremiumPlan | null {
  if (!content) return null;

  if (typeof content === "string") {
    const parsed = tryParseJsonString(content);
    if (parsed) {
      return normalizePremiumPlan(parsed, planType);
    }

    const bullets = splitTextIntoBullets(content);
    if (!bullets.length) return null;

    return {
      closing: "Puedes regenerar este plan para obtener una version mas detallada.",
      coach_notes: [],
      highlights: [],
      intro: bullets[0] ?? "Resumen premium generado para tu objetivo actual.",
      sections: [
        {
          title: planType === "dieta" ? "Resumen de tu plan" : "Resumen de tu rutina",
          bullets,
        },
      ],
      subtitle: defaultSubtitle(planType),
      title: defaultTitle(planType),
    };
  }

  if (typeof content !== "object") {
    return null;
  }

  const record = content as Record<string, unknown>;

  if (Array.isArray(record.sections)) {
    const sections = record.sections
      .map((section) => {
        if (!section || typeof section !== "object") return null;
        const item = section as Record<string, unknown>;
        const title = cleanText(item.title);
        const bullets = normalizeBullets(item.bullets);

        if (!title && !bullets.length) return null;

        return {
          title: title || "Seccion personalizada",
          bullets: bullets.length ? bullets : ["Contenido disponible en esta seccion."],
        };
      })
      .filter(Boolean) as PremiumPlanSection[];

    if (sections.length) {
      return {
        closing: cleanText(record.closing) || "Sigue este plan con constancia y ajustalo segun tu progreso.",
        coach_notes: normalizeBullets(record.coach_notes),
        highlights: normalizeBullets(record.highlights),
        intro: cleanText(record.intro) || "Plan premium generado segun tu perfil actual.",
        sections,
        subtitle: cleanText(record.subtitle) || defaultSubtitle(planType),
        title: cleanText(record.title) || defaultTitle(planType),
      };
    }
  }

  if (planType === "dieta" && Array.isArray(record.meals)) {
    const sections = record.meals
      .map((meal) => {
        if (!meal || typeof meal !== "object") return null;
        const item = meal as Record<string, unknown>;
        const title = cleanText(item.meal) || "Comida";
        const bullets = [
          cleanText(item.items),
          item.cal ? `Calorias estimadas: ${String(item.cal)}` : "",
        ].filter(Boolean);

        if (!bullets.length) return null;

        return { title, bullets };
      })
      .filter(Boolean) as PremiumPlanSection[];

    if (sections.length) {
      return {
        closing: `Macros estimados: Proteinas ${String((record.macros as any)?.proteinas ?? "-")}, Carbohidratos ${String((record.macros as any)?.carbohidratos ?? "-")}, Grasas ${String((record.macros as any)?.grasas ?? "-")}.`,
        coach_notes: [],
        highlights: [],
        intro: "Migramos tu plan anterior al formato premium actual.",
        sections,
        subtitle: cleanText(record.totalCal ? `Total diario estimado: ${String(record.totalCal)}` : "") || defaultSubtitle(planType),
        title: defaultTitle(planType),
      };
    }
  }

  if (planType === "rutina" && Array.isArray(record.days)) {
    const sections = record.days
      .map((day) => {
        if (!day || typeof day !== "object") return null;
        const item = day as Record<string, unknown>;
        const title = `${cleanText(item.day) || "Dia"}${cleanText(item.focus) ? ` - ${cleanText(item.focus)}` : ""}`;
        const bullets = [cleanText(item.exercises), cleanText(item.notes)].filter(Boolean);

        if (!bullets.length) return null;

        return { title, bullets };
      })
      .filter(Boolean) as PremiumPlanSection[];

    if (sections.length) {
      return {
        closing: "Prioriza tecnica, progresion y recuperacion para sostener resultados.",
        coach_notes: [],
        highlights: [],
        intro: "Migramos tu rutina anterior al formato premium actual.",
        sections,
        subtitle: defaultSubtitle(planType),
        title: defaultTitle(planType),
      };
    }
  }

  const fallbackText = cleanText(record.rendered_text) || cleanText(record.text) || cleanText(record.summary);
  if (fallbackText) {
    return normalizePremiumPlan(fallbackText, planType);
  }

  return null;
}

export function normalizePlanForStorage(content: unknown, planType: "dieta" | "rutina") {
  const normalized = normalizePremiumPlan(content, planType);

  if (!normalized) {
    throw new Error("No se pudo normalizar el plan generado");
  }

  return normalized;
}

function buildPlanPrompt(planType: "dieta" | "rutina", profile: FitnessProfile) {
  const profileContext = [
    `Peso: ${profile.weight ?? "sin dato"} kg`,
    `Altura: ${profile.height ?? "sin dato"} cm`,
    `Edad: ${profile.age ?? "sin dato"} anios`,
    `Genero: ${profile.gender ?? "sin dato"}`,
    `Objetivo: ${profile.goal ?? "sin dato"}`,
    `Actividad: ${profile.activity_level ?? "sin dato"}`,
    `Dias disponibles para entrenar: ${profile.training_days ?? "sin dato"}`,
  ].join("\n");

  if (planType === "dieta") {
    return `Eres un nutricionista deportivo premium para una app fitness en espanol.

Perfil del usuario:
${profileContext}

Responde SOLO con JSON valido con esta estructura:
{
  "title": "string",
  "subtitle": "string",
  "intro": "string",
  "highlights": ["string", "string", "string"],
  "sections": [
    {
      "title": "string",
      "bullets": ["string", "string", "string", "string"]
    }
  ],
  "coach_notes": ["string", "string", "string"],
  "closing": "string"
}

Incluye secciones claras y premium sobre:
- resumen del plan
- objetivo calorico
- macronutrientes
- comidas recomendadas
- consejos practicos
- errores a evitar
- accion concreta para hoy

No uses markdown, ni asteriscos, ni emojis. El tono debe sentirse como un nutricionista real, premium y practico.`;
  }

  return `Eres un entrenador personal premium para una app fitness en espanol.

Perfil del usuario:
${profileContext}

Responde SOLO con JSON valido con esta estructura:
{
  "title": "string",
  "subtitle": "string",
  "intro": "string",
  "highlights": ["string", "string", "string"],
  "sections": [
    {
      "title": "string",
      "bullets": ["string", "string", "string", "string"]
    }
  ],
  "coach_notes": ["string", "string", "string"],
  "closing": "string"
}

Incluye secciones claras y premium sobre:
- enfoque semanal
- dias de entrenamiento
- ejercicios por dia
- series y repeticiones
- tecnica y errores a evitar
- descanso y recuperacion
- cardio o actividad complementaria

No uses markdown, ni asteriscos, ni emojis. El tono debe sentirse como un coach real, premium y practico.`;
}

async function callGemini<T>(prompt: string): Promise<T> {
  ensureGeminiConfig();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    console.error("Gemini API error", response.status, text);
    throw new Error(`Gemini fallo con status ${response.status}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error("Gemini payload invalido", payload);
    throw new Error("Gemini no devolvio contenido util");
  }

  try {
    return JSON.parse(extractJsonText(text)) as T;
  } catch (error) {
    console.error("No se pudo parsear la respuesta de Gemini", { error, text, payload });
    throw new Error("No se pudo interpretar la respuesta de Gemini");
  }
}

export async function generateDietPlan(profile: FitnessProfile) {
  const plan = await callGemini<PremiumPlan>(buildPlanPrompt("dieta", profile));
  return normalizePlanForStorage(plan, "dieta");
}

export async function generateWorkoutPlan(profile: FitnessProfile) {
  const plan = await callGemini<PremiumPlan>(buildPlanPrompt("rutina", profile));
  return normalizePlanForStorage(plan, "rutina");
}

export async function estimateDailyNutrition(meals: DailyMealInput, profile: FitnessProfile | null, targets?: { calories: number; protein: number; carbs: number; fats: number } | null) {
  const filledMeals = Object.entries(meals)
    .map(([mealType, text]) => ({ mealType, text: cleanText(text) }))
    .filter((item) => item.text);

  if (!filledMeals.length) {
    throw new Error("No hay comidas para analizar");
  }

  const profileContext = [
    `Objetivo: ${profile?.goal ?? "sin dato"}`,
    `Peso: ${profile?.weight ?? "sin dato"} kg`,
    `Actividad: ${profile?.activity_level ?? "sin dato"}`,
    targets ? `Meta calorica diaria: ${targets.calories}` : "",
    targets ? `Meta de proteina: ${targets.protein} g` : "",
  ].filter(Boolean).join("\n");

  const mealsText = filledMeals.map((meal) => `${meal.mealType}: ${meal.text}`).join("\n");

  return callGemini<DailyNutritionAnalysis>(`Eres un nutricionista premium en espanol.

Perfil del usuario:
${profileContext}

Comidas registradas hoy:
${mealsText}

Responde SOLO con JSON valido con esta estructura:
{
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
  "totals": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fats": 0
  },
  "strengths": ["string", "string"],
  "improve": ["string", "string"],
  "next_meal": "string",
  "coach_message": "string"
}

Debes estimar calorias y macros de forma razonable, explicar que hizo bien el usuario, que mejorar y sugerir la proxima comida. No uses markdown ni asteriscos.`);
}

export async function answerNutritionConsultation(
  question: string,
  profile: FitnessProfile | null,
  contextSummary?: string,
) {
  return callGemini<NutritionConsultation>(`Eres un nutricionista y coach premium 24/7 en espanol.

Perfil del usuario:
Objetivo: ${profile?.goal ?? "sin dato"}
Peso: ${profile?.weight ?? "sin dato"} kg
Actividad: ${profile?.activity_level ?? "sin dato"}
${contextSummary ? `Contexto reciente: ${contextSummary}` : ""}

Pregunta del usuario:
${cleanText(question)}

Responde SOLO con JSON valido con esta estructura:
{
  "answer": "string",
  "action_steps": ["string", "string", "string"]
}

La respuesta debe sentirse como un nutricionista real, premium, cercano y practico. No uses markdown ni asteriscos.`);
}
