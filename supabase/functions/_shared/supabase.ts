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

  const userClient = createUserClient(authHeader);
  const userResult = await userClient.auth.getUser();

  if (userResult.data.user) {
    return { authHeader, supabase: createAdminClient(), user: userResult.data.user };
  }

  console.error("Fallo la validacion del JWT con el cliente de usuario", userResult.error);

  const admin = createAdminClient();
  const adminResult = await admin.auth.getUser(token);

  if (adminResult.error || !adminResult.data.user) {
    console.error("No se pudo validar el JWT del usuario en la edge function", adminResult.error);
    throw new Error("No autenticado");
  }

  return { authHeader, supabase: admin, user: adminResult.data.user };
}
