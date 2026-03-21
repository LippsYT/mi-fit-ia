import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { invokeGeminiJson } from "../_shared/gemini.ts";
import { requireUser } from "../_shared/supabase.ts";

type PremiumPlan = {
  closing: string;
  coach_notes?: string[];
  highlights?: string[];
  intro: string;
  sections: Array<{
    bullets: string[];
    title: string;
  }>;
  subtitle: string;
  title: string;
};

function buildPrompt(planType: "dieta" | "rutina", profile: Record<string, unknown>) {
  const context = [
    `Peso: ${profile.weight ?? "sin dato"} kg`,
    `Altura: ${profile.height ?? "sin dato"} cm`,
    `Edad: ${profile.age ?? "sin dato"} anios`,
    `Genero: ${profile.gender ?? "sin dato"}`,
    `Objetivo: ${profile.goal ?? "sin dato"}`,
    `Actividad: ${profile.activity_level ?? "sin dato"}`,
    `Dias de entrenamiento: ${profile.training_days ?? "sin dato"}`,
  ].join("\n");

  if (planType === "dieta") {
    return `Eres un nutricionista deportivo premium para una app fitness en espanol.

Perfil:
${context}

Responde SOLO con JSON valido:
{
  "title": "string",
  "subtitle": "string",
  "intro": "string",
  "highlights": ["string", "string", "string"],
  "sections": [{ "title": "string", "bullets": ["string"] }],
  "coach_notes": ["string", "string", "string"],
  "closing": "string"
}

Genera un plan de alimentacion premium, claro y accionable.
Incluye:
- objetivo calorico
- distribucion de macronutrientes
- comidas recomendadas
- consejos de adherencia
- accion practica para hoy

No uses markdown, ni asteriscos, ni emojis.`;
  }

  return `Eres un entrenador personal premium para una app fitness en espanol.

Perfil:
${context}

Responde SOLO con JSON valido:
{
  "title": "string",
  "subtitle": "string",
  "intro": "string",
  "highlights": ["string", "string", "string"],
  "sections": [{ "title": "string", "bullets": ["string"] }],
  "coach_notes": ["string", "string", "string"],
  "closing": "string"
}

Genera una rutina premium, clara y accionable.
Incluye:
- enfoque semanal
- dias de entrenamiento
- ejercicios clave
- series y repeticiones
- recomendaciones de tecnica y descanso

No uses markdown, ni asteriscos, ni emojis.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await requireUser(req);

    const { planType } = await req.json() as { planType?: "dieta" | "rutina" };
    if (!planType || !["dieta", "rutina"].includes(planType)) {
      throw new Error("planType invalido");
    }

    const { data: profile, error: profileError } = await supabase
      .from("fitness_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Perfil fitness no encontrado");
    }

    const result = await invokeGeminiJson<PremiumPlan>(buildPrompt(planType, profile));

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-plan edge failed", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
