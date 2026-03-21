import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const syncAuthState = (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Error obteniendo la sesion actual", error);
      }
      syncAuthState(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      syncAuthState(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error cerrando sesion", error);
      throw error;
    }
  };

  return { loading, session, signOut, user };
}
