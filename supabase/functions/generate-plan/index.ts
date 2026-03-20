import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No autenticado");

    const { planType } = await req.json();
    if (!planType || !["dieta", "rutina"].includes(planType)) {
      throw new Error("planType debe ser 'dieta' o 'rutina'");
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Perfil no encontrado. Completa el formulario primero.");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const objectiveLabels: Record<string, string> = {
      "perder-peso": "perder peso y grasa corporal",
      "ganar-musculo": "ganar masa muscular",
      "tonificar": "tonificar el cuerpo",
      "mantener": "mantener el peso actual",
    };

    const activityLabels: Record<string, string> = {
      sedentario: "sedentario (poco o nada de ejercicio)",
      ligero: "actividad ligera (1-3 días/semana)",
      moderado: "moderado (3-5 días/semana)",
      activo: "muy activo (6-7 días/semana)",
    };

    const userContext = `Datos del usuario:
- Peso: ${profile.peso} kg
- Altura: ${profile.altura} cm
- Edad: ${profile.edad} años
- Género: ${profile.genero}
- Objetivo: ${objectiveLabels[profile.objetivo] || profile.objetivo}
- Nivel de actividad: ${activityLabels[profile.actividad] || profile.actividad}
- Días disponibles para entrenar: ${profile.dias}`;

    let systemPrompt: string;

    if (planType === "dieta") {
      systemPrompt = `Eres un nutricionista deportivo experto. Genera un plan de dieta diario personalizado en español.
${userContext}

Responde SOLO con un JSON válido con esta estructura exacta (sin markdown, sin texto extra):
{
  "meals": [
    { "meal": "nombre de la comida", "items": "descripción de los alimentos", "cal": "XXX kcal" }
  ],
  "totalCal": "XXXX kcal",
  "macros": { "proteinas": "XXXg", "carbohidratos": "XXXg", "grasas": "XXXg" }
}

Incluye 5 comidas: Desayuno, Media mañana, Almuerzo, Merienda y Cena. Sé específico con porciones y alimentos reales.`;
    } else {
      systemPrompt = `Eres un entrenador personal experto. Genera una rutina semanal personalizada en español.
${userContext}

Responde SOLO con un JSON válido con esta estructura exacta (sin markdown, sin texto extra):
{
  "days": [
    { "day": "nombre del día", "focus": "grupo muscular o tipo", "exercises": "ejercicios con series y repeticiones" }
  ]
}

Genera exactamente ${profile.dias} días de entrenamiento + días de descanso activo para completar la semana. Sé específico con ejercicios, series y repeticiones.`;
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Genera mi ${planType === "dieta" ? "plan de dieta" : "rutina semanal"} personalizado.` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: planType === "dieta" ? "generate_diet" : "generate_routine",
              description: planType === "dieta" ? "Generate a personalized diet plan" : "Generate a personalized workout routine",
              parameters: planType === "dieta"
                ? {
                    type: "object",
                    properties: {
                      meals: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            meal: { type: "string" },
                            items: { type: "string" },
                            cal: { type: "string" },
                          },
                          required: ["meal", "items", "cal"],
                          additionalProperties: false,
                        },
                      },
                      totalCal: { type: "string" },
                      macros: {
                        type: "object",
                        properties: {
                          proteinas: { type: "string" },
                          carbohidratos: { type: "string" },
                          grasas: { type: "string" },
                        },
                        required: ["proteinas", "carbohidratos", "grasas"],
                        additionalProperties: false,
                      },
                    },
                    required: ["meals", "totalCal", "macros"],
                    additionalProperties: false,
                  }
                : {
                    type: "object",
                    properties: {
                      days: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            day: { type: "string" },
                            focus: { type: "string" },
                            exercises: { type: "string" },
                          },
                          required: ["day", "focus", "exercises"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["days"],
                    additionalProperties: false,
                  },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: planType === "dieta" ? "generate_diet" : "generate_routine" },
        },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta de nuevo en unos segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      throw new Error("Error generando el plan con IA");
    }

    const aiData = await aiResponse.json();
    let planContent: any;

    // Extract from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      planContent = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: try to parse from content
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        planContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No se pudo parsear la respuesta de IA");
      }
    }

    // Save to DB
    const { error: insertError } = await supabase.from("generated_plans").insert({
      user_id: user.id,
      plan_type: planType,
      content: planContent,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Error guardando el plan");
    }

    return new Response(JSON.stringify({ plan: planContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
