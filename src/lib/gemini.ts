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

export type PremiumPlan = {
  closing: string;
  intro: string;
  sections: Array<{
    bullets: string[];
    title: string;
  }>;
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
    return JSON.parse(text) as PremiumPlan;
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
