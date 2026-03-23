import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brain, CalendarDays, Crown, Lock, Smartphone, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { useAccessStatus } from "@/hooks/useAccessStatus";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";
import heroImage from "@/assets/hero-fitness.jpg";
import Navbar from "@/components/Navbar";

type StartOfferHandler = (source: string) => Promise<void>;

function OfferTicker() {
  const tickerItems = [
    "OFERTA POR TIEMPO LIMITADO",
    "ANTES AR$ 35.000",
    "HOY AR$ 11.499/MES",
    "SISTEMA DE NUTRICION + ENTRENAMIENTO + IA",
    "AJUSTE SEMANAL Y BLOQUE MENSUAL",
  ];

  return (
    <div className="fixed left-0 right-0 top-16 z-40 border-b border-primary/20 bg-gradient-to-r from-primary/15 via-primary/5 to-primary/15 backdrop-blur-xl">
      <div className="overflow-hidden whitespace-nowrap">
        <div className="animate-marquee-left flex w-max min-w-full items-center gap-10 px-6 py-2">
          {[...tickerItems, ...tickerItems].map((item, index) => (
            <div key={`${item}-${index}`} className="flex items-center gap-3 text-sm font-semibold tracking-[0.18em] text-primary">
              <span>{item}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroSection({
  ctaLoading,
  ctaLabel,
  onStart,
}: {
  ctaLoading: boolean;
  ctaLabel: string;
  onStart: StartOfferHandler;
}) {
  const ref = useScrollReveal();

  return (
    <section ref={ref} className="relative flex min-h-screen items-center overflow-hidden pt-28">
      <div className="absolute inset-0">
        <img src={heroImage} alt="" className="h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/60" />
      </div>

      <div className="container relative mx-auto section-padding py-20 lg:py-32">
        <div className="max-w-3xl">
          <div
            data-reveal
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary opacity-0"
          >
            <Zap className="h-4 w-4" />
            Potenciado por inteligencia artificial
          </div>

          <h1
            data-reveal
            className="mb-6 font-display text-4xl font-bold leading-[1.02] tracking-tight opacity-0 sm:text-5xl lg:text-6xl"
          >
            No es una dieta. <span className="text-gradient">Es un sistema que se adapta a vos y te lleva al resultado.</span>
          </h1>

          <p data-reveal className="mb-8 max-w-2xl text-lg leading-relaxed text-muted-foreground opacity-0">
            Organiza lo que comes, lo que entrenas y lo que ajustas cada semana. El usuario paga por claridad, acompanamiento
            y progreso visible, no por consejos sueltos.
          </p>

          <div data-reveal className="mb-6 flex flex-col gap-3 opacity-0 sm:flex-row">
            <Button variant="hero" size="xl" onClick={() => void onStart("hero_primary")} disabled={ctaLoading}>
              {ctaLoading ? "Cargando..." : ctaLabel}
            </Button>
            <Link to="/login">
              <Button variant="outline" size="xl">Ya tengo cuenta</Button>
            </Link>
          </div>

          <div data-reveal className="mb-10 inline-flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-5 py-3 text-sm text-primary opacity-0">
            <Crown className="h-4 w-4" />
            <span className="font-semibold">Oferta limitada:</span>
            <span className="line-through text-primary/60">AR$ 35.000</span>
            <span className="font-bold">AR$ 11.499 / mes</span>
          </div>

          <div data-reveal className="grid gap-8 text-sm text-muted-foreground opacity-0 sm:grid-cols-4">
            <div>
              <span className="block font-display text-2xl font-bold text-foreground tabular-nums">2,847+</span>
              usuarios activos
            </div>
            <div>
              <span className="block font-display text-2xl font-bold text-foreground tabular-nums">94.3%</span>
              satisfaccion
            </div>
            <div>
              <span className="block font-display text-2xl font-bold text-foreground tabular-nums">AR$ 11.499</span>
              precio actual
            </div>
            <div>
              <span className="block font-display text-2xl font-bold text-foreground tabular-nums">12x</span>
              ajustes al ano
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const features = [
  { icon: Brain, title: "Nutricion dinamica", desc: "Plan diario ajustable con IA, alternativas y decisiones utiles para vida real." },
  { icon: CalendarDays, title: "Rutina viva", desc: "Semana de entrenamiento conectada con tu objetivo, cumplimiento y energia." },
  { icon: TrendingUp, title: "Progreso visible", desc: "Peso, adherencia, rachas, check-ins y evolucion clara para sostener la suscripcion." },
  { icon: Smartphone, title: "Acompanamiento diario", desc: "Dashboard, feedback, chat accionable y sistema que no te deja improvisar." },
];

function FeaturesSection() {
  const ref = useScrollReveal();

  return (
    <section ref={ref} className="py-24 lg:py-32">
      <div className="container mx-auto section-padding">
        <div className="mb-16 text-center">
          <h2 data-reveal className="mb-4 font-display text-3xl font-bold tracking-tight opacity-0 sm:text-4xl">
            Una membresia que el cliente <span className="text-gradient">quiere renovar</span>
          </h2>
          <p data-reveal className="mx-auto max-w-2xl text-muted-foreground opacity-0">
            El valor no esta en leer un plan una vez. El valor esta en tener un sistema que organiza el dia, ajusta la semana y
            evita arrancar de cero cada mes.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              data-reveal
              className="glass-card rounded-xl p-6 opacity-0 transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-2 font-display text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection({
  ctaLoading,
  ctaLabel,
  onStart,
}: {
  ctaLoading: boolean;
  ctaLabel: string;
  onStart: StartOfferHandler;
}) {
  const ref = useScrollReveal();

  return (
    <section ref={ref} className="bg-secondary/30 py-24 lg:py-32">
      <div className="container mx-auto section-padding">
        <div className="mx-auto max-w-md text-center">
          <h2 data-reveal className="mb-4 font-display text-3xl font-bold tracking-tight opacity-0 sm:text-4xl">
            Oferta premium de lanzamiento
          </h2>
          <p data-reveal className="mb-12 text-muted-foreground opacity-0">
            Primero perfilamos al usuario. Despues activa la membresia y entra al sistema completo.
          </p>

          <div data-reveal className="glass-card glow-primary rounded-2xl p-8 opacity-0">
            <div className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-primary">Plan Premium</div>
            <div className="mb-2 text-sm text-muted-foreground line-through">AR$ 35.000 / mes</div>
            <div className="mb-6 flex items-baseline justify-center gap-1">
              <span className="font-display text-5xl font-bold">AR$ 11.499</span>
              <span className="text-muted-foreground">/mes</span>
            </div>

            <ul className="mb-8 space-y-3 text-left text-sm">
              {[
                "Onboarding premium con perfilado completo",
                "Nutricion y entrenamiento conectados entre si",
                "Ajuste semanal obligatorio segun resultados",
                "Dashboard diario con progreso y adherencia",
                "Chat IA util para resolver la vida real",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <Zap className="h-4 w-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>

            <Button variant="hero" size="lg" className="w-full" onClick={() => void onStart("pricing_primary")} disabled={ctaLoading}>
              {ctaLoading ? "Cargando..." : ctaLabel}
            </Button>

            <p className="mt-4 text-xs text-muted-foreground">
              Sin plan gratuito y sin version limitada. El acceso completo se activa con suscripcion.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaSection({
  ctaLoading,
  ctaLabel,
  onStart,
}: {
  ctaLoading: boolean;
  ctaLabel: string;
  onStart: StartOfferHandler;
}) {
  const ref = useScrollReveal();

  return (
    <section ref={ref} className="py-24 lg:py-32">
      <div className="container mx-auto section-padding text-center">
        <Lock data-reveal className="mx-auto mb-6 h-10 w-10 text-primary opacity-0" />
        <h2 data-reveal className="mb-4 font-display text-3xl font-bold tracking-tight opacity-0 sm:text-4xl">
          Deja de empezar de cero cada semana
        </h2>
        <p data-reveal className="mx-auto mb-8 max-w-2xl text-muted-foreground opacity-0">
          Este sistema se adapta a vos, organiza tus decisiones y convierte el progreso en algo visible. Eso es lo que hace
          dificil abandonar la suscripcion.
        </p>
        <div data-reveal className="opacity-0">
          <Button variant="hero" size="xl" onClick={() => void onStart("bottom_cta")} disabled={ctaLoading}>
            {ctaLoading ? "Cargando..." : ctaLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasActiveSubscription, loading: accessLoading, onboardingCompleted } = useAccessStatus();
  const [ctaLoading, setCtaLoading] = useState(false);

  const handleStartOffer = async (source: string) => {
    setCtaLoading(true);

    try {
      trackEvent("landing_cta_clicked", {
        has_subscription: hasActiveSubscription,
        onboarding_completed: onboardingCompleted,
        signed_in: Boolean(user),
        source,
      });

      if (!user) {
        navigate("/registro");
        return;
      }

      if (!onboardingCompleted) {
        navigate("/formulario");
        return;
      }

      if (!hasActiveSubscription) {
        navigate("/suscripcion");
        return;
      }

      navigate("/dashboard");
    } finally {
      setCtaLoading(false);
    }
  };

  const actionLabel = !user
    ? "Empezar ahora"
    : accessLoading
      ? "Cargando..."
      : !onboardingCompleted
        ? "Completar onboarding"
        : !hasActiveSubscription
          ? "Activar suscripcion"
          : "Ir a mi sistema";

  return (
    <div className="min-h-screen">
      <Navbar />
      <OfferTicker />
      <HeroSection ctaLoading={ctaLoading || accessLoading} ctaLabel={actionLabel} onStart={handleStartOffer} />
      <FeaturesSection />
      <PricingSection ctaLoading={ctaLoading || accessLoading} ctaLabel={actionLabel} onStart={handleStartOffer} />
      <CtaSection ctaLoading={ctaLoading || accessLoading} ctaLabel={actionLabel} onStart={handleStartOffer} />
      <footer className="border-t border-border/30 py-8 text-center text-sm text-muted-foreground section-padding">
        {"\u00A9"} 2026 FIT AI SYSTEM. Todos los derechos reservados.
      </footer>
    </div>
  );
}
