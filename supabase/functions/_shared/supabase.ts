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

  const supabase = createUserClient(authHeader);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("No autenticado");
  }

  return { authHeader, supabase, user: data.user };
}
