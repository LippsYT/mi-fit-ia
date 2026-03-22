import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dumbbell, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

function isActiveSubscription(subscription: { current_period_end?: string | null; status?: string | null } | null) {
  if (!subscription) return false;
  if (!subscription.status || !["active", "trialing"].includes(subscription.status)) return false;
  if (!subscription.current_period_end) return true;
  return new Date(subscription.current_period_end) > new Date();
}

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      toast({
        title: "Error al iniciar sesion",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const user = data.user;

    if (!user) {
      setLoading(false);
      toast({
        title: "No se pudo recuperar tu cuenta",
        description: "Vuelve a intentarlo.",
        variant: "destructive",
      });
      return;
    }

    const [profileResult, subscriptionResult] = await Promise.all([
      supabase
        .from("fitness_profiles" as any)
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    setLoading(false);

    if (profileResult.error) {
      console.error("Error cargando onboarding despues del login", profileResult.error);
    }

    if (subscriptionResult.error) {
      console.error("Error cargando suscripcion despues del login", subscriptionResult.error);
    }

    const onboardingCompleted = Boolean((profileResult.data as { onboarding_completed?: boolean } | null)?.onboarding_completed);
    const hasSubscription = isActiveSubscription((subscriptionResult.data as { current_period_end?: string | null; status?: string | null } | null) ?? null);

    if (!onboardingCompleted) {
      navigate("/formulario");
      return;
    }

    navigate(hasSubscription ? "/dashboard" : "/suscripcion");
  };

  return (
    <div className="flex min-h-screen items-center justify-center section-padding py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-xl font-bold tracking-tight">
          <Dumbbell className="h-6 w-6 text-primary" />
          <span>FIT AI</span>
          <span className="text-primary">SYSTEM</span>
        </Link>

        <div className="glass-card rounded-2xl p-8">
          <h1 className="mb-1 font-display text-2xl font-bold">Iniciar sesion</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Entra a tu sistema para continuar con tu onboarding, activar la suscripcion o volver directo al dashboard.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contrasena</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="********"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="bg-background/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            No tienes cuenta?{" "}
            <Link to="/registro" className="font-medium text-primary hover:underline">
              Registrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
