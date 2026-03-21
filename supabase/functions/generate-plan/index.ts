import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type PremiumPlan = {
  closing: string;
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
  "sections": [{ "title": "string", "bullets": ["string"] }],
  "closing": "string"
}

Genera un plan de alimentacion premium, claro y accionable.`;
  }

  return `Eres un entrenador personal premium para una app fitness en espanol.

Perfil:
${context}

Responde SOLO con JSON valido:
{
  "title": "string",
  "subtitle": "string",
  "intro": "string",
  "sections": [{ "title": "string", "bullets": ["string"] }],
  "closing": "string"
}

Genera una rutina premium, clara y accionable.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) throw new Error("No autenticado");

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

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    console.log("backend gemini loaded?", !!geminiApiKey);
    if (!geminiApiKey) throw new Error("Missing Gemini API key");

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
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
      console.error("Gemini edge error", response.status, text);
      throw new Error("Error generando contenido con Gemini");
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("Gemini edge payload invalido", payload);
      throw new Error("Gemini no devolvio texto");
    }

    const result = JSON.parse(text) as PremiumPlan;

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
