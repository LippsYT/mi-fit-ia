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
  intro: string;
  sections: PremiumPlanSection[];
  subtitle: string;
  title: string;
};

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL ?? "gemini-2.5-flash";

function ensureGeminiConfig() {
  if (!GEMINI_API_KEY) {
    throw new Error("Falta VITE_GEMINI_API_KEY");
  }
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeBullets(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item))
    .filter(Boolean);
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

  return trimmed;
}

export function normalizePremiumPlan(content: unknown, planType: "dieta" | "rutina"): PremiumPlan | null {
  if (!content) return null;

  if (typeof content === "string") {
    const bullets = splitTextIntoBullets(content);
    if (!bullets.length) return null;

    return {
      closing: "Puedes regenerar este plan para obtener una version mas detallada.",
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
        const bullets = [
          cleanText(item.exercises),
          cleanText(item.notes),
        ].filter(Boolean);

        if (!bullets.length) return null;

        return { title, bullets };
      })
      .filter(Boolean) as PremiumPlanSection[];

    if (sections.length) {
      return {
        closing: "Prioriza tecnica, progresion y recuperacion para sostener resultados.",
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

function buildPrompt(planType: "dieta" | "rutina", profile: FitnessProfile) {
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
    return `Eres un nutricionista deportivo premium para una app SaaS fitness en espanol.

Perfil del usuario:
${profileContext}

Genera un plan de alimentacion semanal premium, claro, accionable y realista.
Quiero un tono profesional, cercano y util. No uses markdown.

Responde SOLO con JSON valido con esta estructura:
{
  "title": "string",
  "subtitle": "string",
  "intro": "string",
  "sections": [
    {
      "title": "string",
      "bullets": ["string", "string", "string"]
    }
  ],
  "closing": "string"
}

Incluye secciones concretas sobre:
- calorias y enfoque nutricional
- distribucion de comidas
- ejemplo de menu diario
- lista de alimentos recomendados
- consejos de adherencia y hidratacion

Haz que el resultado se vea premium y personalizado.`;
  }

  return `Eres un entrenador personal premium para una app SaaS fitness en espanol.

Perfil del usuario:
${profileContext}

Genera una rutina semanal premium, clara, accionable y realista.
Quiero un tono profesional, cercano y util. No uses markdown.

Responde SOLO con JSON valido con esta estructura:
{
  "title": "string",
  "subtitle": "string",
  "intro": "string",
  "sections": [
    {
      "title": "string",
      "bullets": ["string", "string", "string"]
    }
  ],
  "closing": "string"
}

Incluye secciones concretas sobre:
- enfoque general de entrenamiento
- division semanal adaptada a los dias disponibles
- ejercicios clave con series y repeticiones
- progresion y recuperacion
- recomendaciones de constancia

Haz que el resultado se vea premium y personalizado.`;
}

async function callGemini(planType: "dieta" | "rutina", profile: FitnessProfile) {
  ensureGeminiConfig();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(planType, profile) }],
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
    const parsed = JSON.parse(extractJsonText(text));
    return normalizePlanForStorage(parsed, planType);
  } catch (error) {
    console.error("No se pudo parsear la respuesta de Gemini", { error, text, payload });
    throw new Error("No se pudo interpretar la respuesta de Gemini");
  }
}

export function generateDietPlan(profile: FitnessProfile) {
  return callGemini("dieta", profile);
}

export function generateWorkoutPlan(profile: FitnessProfile) {
  return callGemini("rutina", profile);
}
