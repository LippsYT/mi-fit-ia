import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { invokeGeminiJson } from "../_shared/gemini.ts";
import { requireUser } from "../_shared/supabase.ts";

type FitnessProfile = {
  activity_level?: string | null;
  age?: number | null;
  gender?: string | null;
  goal?: string | null;
  height?: number | null;
  training_days?: number | null;
  weight?: number | null;
};

type CoachAnswer = {
  action_steps: string[];
  answer: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildPrompt(question: string, profile: FitnessProfile | null, contextSummary: string) {
  const profileLines = [
    `Objetivo: ${profile?.goal ?? "sin dato"}`,
    `Peso: ${profile?.weight ?? "sin dato"} kg`,
    `Altura: ${profile?.height ?? "sin dato"} cm`,
    `Edad: ${profile?.age ?? "sin dato"}`,
    `Genero: ${profile?.gender ?? "sin dato"}`,
    `Actividad: ${profile?.activity_level ?? "sin dato"}`,
    `Dias de entrenamiento: ${profile?.training_days ?? "sin dato"}`,
    contextSummary ? `Contexto reciente: ${contextSummary}` : "",
  ].filter(Boolean).join("\n");

  return `Eres un nutricionista y coach premium 24/7 de una app fitness en espanol.

Perfil del usuario:
${profileLines}

Pregunta del usuario:
${question}

Responde SOLO con JSON valido con esta estructura:
{
  "answer": "string",
  "action_steps": ["string", "string"]
}

Instrucciones:
- responde como un coach/nutricionista real
- se practico, claro y premium
- di si algo conviene, no conviene o como adaptarlo
- cierra con accion concreta y util
- no uses markdown, ni asteriscos, ni emojis`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireUser(req);

    const { contextSummary, profile, question } = await req.json() as {
      contextSummary?: string;
      profile?: FitnessProfile | null;
      question?: string;
    };

    const cleanQuestion = cleanText(question);
    if (!cleanQuestion) {
      throw new Error("Missing question");
    }

    const result = await invokeGeminiJson<CoachAnswer>(
      buildPrompt(cleanQuestion, profile ?? null, cleanText(contextSummary)),
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ask-coach failed", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
