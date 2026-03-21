function requireGeminiKey() {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  console.log("backend gemini loaded?", !!geminiApiKey);

  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  return geminiApiKey;
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

export async function invokeGeminiJson<T>(prompt: string) {
  const geminiApiKey = requireGeminiKey();

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
    console.error("Gemini edge error", response.status, text);
    throw new Error("Error generando contenido con Gemini");
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error("Gemini edge payload invalido", payload);
    throw new Error("Gemini no devolvio texto");
  }

  try {
    return JSON.parse(extractJsonText(text)) as T;
  } catch (error) {
    console.error("No se pudo parsear JSON de Gemini en backend", { error, text, payload });
    throw new Error("Gemini devolvio un JSON invalido");
  }
}
