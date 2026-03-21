import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function createUserClient(authHeader: string) {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: authHeader } } },
  );
}

export function createAdminClient() {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing Authorization header");

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing bearer token");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);

  if (error || !data.user) {
    console.error("No se pudo validar el JWT del usuario en la edge function", error);
    throw new Error("No autenticado");
  }

  return { authHeader, supabase: admin, user: data.user };
}
