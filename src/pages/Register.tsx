import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dumbbell, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { startCheckout } from "@/lib/checkout";

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const checkoutIntent = searchParams.get("checkout") === "1";

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { name: form.name },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setLoading(false);
      toast({ title: "Error al crear cuenta", description: error.message, variant: "destructive" });
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
        toast({ title: "No se pudo iniciar el pago", description: checkoutError.message ?? "Error inesperado", variant: "destructive" });
        navigate("/failed");
        return;
      }
    }

    setLoading(false);

    if (checkoutIntent) {
      toast({
        title: "Cuenta creada",
        description: "Inicia sesiÃ³n para continuar con el checkout premium.",
      });
      navigate("/login?checkout=1");
      return;
    }

    toast({ title: "Â¡Cuenta creada!", description: "Revisa tu email para confirmar tu cuenta." });
    navigate("/login");
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
          <h1 className="mb-1 font-display text-2xl font-bold">Crear cuenta</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {checkoutIntent ? "Crea tu cuenta para activar el premium y seguir al pago" : "Comienza tu transformaciÃ³n hoy"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" placeholder="Tu nombre" value={form.name} onChange={(e) => update("name", e.target.value)} required className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="tu@email.com" value={form.email} onChange={(e) => update("email", e.target.value)} required className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">ContraseÃ±a</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="MÃ­nimo 6 caracteres" value={form.password} onChange={(e) => update("password", e.target.value)} required minLength={6} className="bg-background/50 pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</> : checkoutIntent ? "Crear cuenta y seguir" : "Crear cuenta"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Â¿Ya tienes cuenta?{" "}
            <Link to={checkoutIntent ? "/login?checkout=1" : "/login"} className="font-medium text-primary hover:underline">Inicia sesiÃ³n</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
