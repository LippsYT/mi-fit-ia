import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Crown, Loader2, ShieldCheck, Sparkles, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccessStatus } from "@/hooks/useAccessStatus";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { startCheckout } from "@/lib/checkout";
import heroImage from "@/assets/hero-fitness.jpg";

const premiumBenefits = [
  "Sistema completo de nutricion + entrenamiento con IA",
  "Ajustes semanales segun progreso, energia y adherencia",
  "Dashboard diario con comidas, entrenamiento y racha",
  "Seguimiento premium para que renovar tenga sentido real",
];

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, user } = useAuth();
  const { hasActiveSubscription, loading, onboardingCompleted } = useAccessStatus();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const fromOnboarding = searchParams.get("fromOnboarding") === "1";

  useEffect(() => {
    if (loading) return;
    if (!onboardingCompleted && !fromOnboarding) {
      navigate("/formulario", { replace: true });
      return;
    }
    if (hasActiveSubscription) {
      navigate("/dashboard", { replace: true });
    }
  }, [fromOnboarding, hasActiveSubscription, loading, navigate, onboardingCompleted]);

  const handleSubscribe = async () => {
    if (!session?.access_token || !user?.email) {
      navigate("/login", { replace: true });
      return;
    }

    setCheckoutLoading(true);

    try {
      const url = await startCheckout({
        accessToken: session.access_token,
        email: user.email,
        userId: user.id,
      });

      window.location.href = url;
    } catch (error: any) {
      toast({
        title: "No se pudo iniciar el pago",
        description: error.message ?? "Error inesperado",
        variant: "destructive",
      });
      navigate("/failed");
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroImage} alt="" className="h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />
      </div>

      <div className="relative container mx-auto section-padding py-16 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-8 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="glass-card rounded-3xl p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
              <ShieldCheck className="h-4 w-4" />
              Acceso premium obligatorio
            </div>

            <h1 className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Deja de empezar de cero cada semana.
              <span className="block text-gradient">Este sistema se adapta a vos y te lleva al resultado.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              No estas pagando por una dieta. Estas activando un sistema que organiza lo que comes, lo que entrenas y lo que ajustas
              cada semana para que no tengas que volver a improvisar.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {premiumBenefits.map((benefit) => (
                <div key={benefit} className="rounded-2xl border border-border/60 bg-background/25 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-primary/10 p-2">
                      <Zap className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/90">{benefit}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/25 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Semanal</div>
                <div className="mt-2 text-lg font-bold">Ajuste real</div>
                <p className="mt-1 text-sm text-muted-foreground">Cambios segun resultados, hambre y adherencia.</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/25 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Diario</div>
                <div className="mt-2 text-lg font-bold">Direccion clara</div>
                <p className="mt-1 text-sm text-muted-foreground">Comidas, entrenamiento y acciones del dia listas.</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/25 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mensual</div>
                <div className="mt-2 text-lg font-bold">Nuevo bloque</div>
                <p className="mt-1 text-sm text-muted-foreground">El sistema se refresca para que no se sienta congelado.</p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-8 lg:p-10">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Membresia unica</div>
                <h2 className="font-display text-2xl font-bold">Activa tu sistema premium</h2>
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-primary/20 bg-primary/5 p-6">
              <div className="text-sm text-muted-foreground line-through">Antes AR$ 35.000 / mes</div>
              <div className="mt-3 flex items-end gap-2">
                <span className="font-display text-5xl font-bold">AR$ 11.499</span>
                <span className="pb-2 text-muted-foreground">/ mes</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Acceso completo inmediato despues del pago. Sin plan gratis, sin demo limitada y sin desbloqueos parciales.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              {[
                "Plan nutricional estructurado y adaptable",
                "Rutina integrada con dias de entrenamiento y descanso",
                "Check-in semanal obligatorio con optimizacion automatica",
                "Chat IA util para resolver vida real, no decorativo",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-border/60 bg-background/20 p-4">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-foreground/90">{item}</span>
                </div>
              ))}
            </div>

            <Button className="mt-8 w-full" variant="hero" size="xl" onClick={() => void handleSubscribe()} disabled={checkoutLoading}>
              {checkoutLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirigiendo...
                </>
              ) : "Empezar ahora"}
            </Button>

            <button type="button" onClick={() => navigate("/formulario")} className="mt-4 w-full text-sm text-muted-foreground transition hover:text-foreground">
              Volver a editar onboarding
            </button>

            <div className="mt-8 rounded-2xl border border-border/60 bg-background/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Promesa del sistema</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Lo que pagas no es un PDF. Es un sistema que se adapta a vos, te organiza el dia y te ayuda a sostener resultados.
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm text-foreground/90">
                <TrendingUp className="h-4 w-4 text-primary" />
                Ajustes semanales + renovacion mensual con sentido
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
