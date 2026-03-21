import { createClient } from "@supabase/supabase-js";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const supabaseAdmin = createClient(
  getEnv("SUPABASE_URL"),
  getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

const supabaseAnon = createClient(
  getEnv("SUPABASE_URL"),
  getEnv("SUPABASE_ANON_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export async function getAuthenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace("Bearer ", "").trim();

  if (!token) {
    throw new Error("Missing Authorization header");
  }

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) {
    console.error("Supabase auth error in API route", error);
    throw new Error("Unauthorized");
  }

  return data.user;
}
