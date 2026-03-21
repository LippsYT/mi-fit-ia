import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

let cachedAdmin: SupabaseClient | null = null;
let cachedAnon: SupabaseClient | null = null;

function getEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }

  console.error("Missing Supabase environment variables", {
    available: names.map((name) => ({ name, present: Boolean(process.env[name]) })),
  });

  throw new Error(`Missing environment variable: ${names.join(" or ")}`);
}

function getSupabaseUrl() {
  return getEnv("VITE_SUPABASE_URL", "SUPABASE_URL");
}

function getSupabaseAnonKey() {
  return getEnv("VITE_SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");
}

function getSupabaseServiceRoleKey() {
  return getEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getSupabaseAdmin() {
  if (!cachedAdmin) {
    cachedAdmin = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return cachedAdmin;
}

function getSupabaseAnon() {
  if (!cachedAnon) {
    cachedAnon = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return cachedAnon;
}

export async function getAuthenticatedUserFromAccessToken(accessToken: string): Promise<User> {
  if (!accessToken) {
    console.error("Missing Authorization header in checkout request");
    throw new Error("Unauthorized");
  }

  const { data, error } = await getSupabaseAnon().auth.getUser(accessToken);

  if (error || !data.user) {
    console.error("Supabase auth error in API route", { error, hasUser: Boolean(data?.user) });
    throw new Error("Unauthorized");
  }

  return data.user;
}
