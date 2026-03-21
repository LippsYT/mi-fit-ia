import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Dumbbell, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { startCheckout } from "@/lib/checkout";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const checkoutIntent = searchParams.get("checkout") === "1";

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

    if (checkoutIntent && data.session?.access_token && data.user?.email) {
      try {
        const url = await startCheckout({
          accessToken: data.session.access_token,
          email: data.user.email,
          userId: data.user.id,
        });

        window.location.href = url;
        return;
      } catch (checkoutError: any) {
        setLoading(false);
        toast({
          title: "No se pudo iniciar el pago",
          description: checkoutError.message ?? "Error inesperado",
          variant: "destructive",
        });
        navigate("/failed");
        return;
      }
    }

    setLoading(false);
    navigate("/dashboard");
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
            {checkoutIntent ? "Entra para continuar directo al checkout premium" : "Accede a tu plan personalizado"}
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
              ) : checkoutIntent ? "Entrar y pagar" : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            No tienes cuenta?{" "}
            <Link to={checkoutIntent ? "/registro?checkout=1" : "/registro"} className="font-medium text-primary hover:underline">
              Registrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
