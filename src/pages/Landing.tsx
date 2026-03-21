import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brain, CalendarDays, Crown, Lock, Smartphone, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { startCheckout } from "@/lib/checkout";
import heroImage from "@/assets/hero-fitness.jpg";
import Navbar from "@/components/Navbar";

type StartOfferHandler = () => Promise<void>;

function OfferTicker() {
  const tickerItems = [
    "OFERTA POR TIEMPO LIMITADO",
    "ANTES AR$ 35.000",
    "HOY AR$ 11.499/MES",
    "DIETA + RUTINA + EJERCICIOS IA + SEGUIMIENTO PREMIUM",
    "CANCELA CUANDO QUIERAS",
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

function HeroSection({ ctaLoading, onStart }: { ctaLoading: boolean; onStart: StartOfferHandler }) {
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
            Tu plan fitness personalizado <span className="text-gradient">para pagar, usar y renovar con sentido</span>
          </h1>

          <p data-reveal className="mb-8 max-w-2xl text-lg leading-relaxed text-muted-foreground opacity-0">
            Dieta, rutina, ejercicios recomendados por IA, seguimiento nutricional, check-ins y ajustes mensuales segun tu objetivo.
            Todo en una sola membresia premium pensada para que el cliente sienta valor real cada mes.
          </p>

          <div data-reveal className="mb-6 flex flex-col gap-3 opacity-0 sm:flex-row">
            <Button variant="hero" size="xl" onClick={() => void onStart()} disabled={ctaLoading}>
              {ctaLoading ? "Redirigiendo..." : "Empezar ahora"}
            </Button>
            <Link to="/login?checkout=1">
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
              ajustes al año
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const features = [
  { icon: Brain, title: "Dieta con IA", desc: "Nutricion guiada segun tu perfil, objetivo y comidas reales del dia." },
  { icon: CalendarDays, title: "Rutina semanal", desc: "Plan semanal que cambia segun tu disponibilidad y enfoque del mes." },
  { icon: TrendingUp, title: "Ejercicios por objetivo", desc: "Recomendaciones distintas para bajar grasa, ganar musculo o mantener." },
  { icon: Smartphone, title: "Seguimiento premium", desc: "Check-ins, calorias, macros y feedback para que el pago se sienta util." },
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
            El valor no esta solo en un texto generado. Esta en sentir cada semana que el plan se mueve con el cuerpo, el objetivo y el progreso real.
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

function PricingSection({ ctaLoading, onStart }: { ctaLoading: boolean; onStart: StartOfferHandler }) {
  const ref = useScrollReveal();

  return (
    <section ref={ref} className="bg-secondary/30 py-24 lg:py-32">
      <div className="container mx-auto section-padding">
        <div className="mx-auto max-w-md text-center">
          <h2 data-reveal className="mb-4 font-display text-3xl font-bold tracking-tight opacity-0 sm:text-4xl">
            Oferta premium de lanzamiento
          </h2>
          <p data-reveal className="mb-12 text-muted-foreground opacity-0">
            Pensado para vender una suscripcion que el cliente perciba necesaria mes a mes.
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
                "Dieta premium con seguimiento nutricional real",
                "Rutina semanal con ejercicios recomendados por objetivo",
                "Ajuste mensual para evitar estancamiento",
                "Consultas rapidas y feedback IA 24/7",
                "Check-ins para sentir avance, no solo leer consejos",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <Zap className="h-4 w-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>

            <Button variant="hero" size="lg" className="w-full" onClick={() => void onStart()} disabled={ctaLoading}>
              {ctaLoading ? "Redirigiendo..." : "Activar oferta ahora"}
            </Button>

            <p className="mt-4 text-xs text-muted-foreground">
              Sin plan gratis desde la landing principal. Entras para activar la oferta y convertir.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaSection({ ctaLoading, onStart }: { ctaLoading: boolean; onStart: StartOfferHandler }) {
  const ref = useScrollReveal();

  return (
    <section ref={ref} className="py-24 lg:py-32">
      <div className="container mx-auto section-padding text-center">
        <Lock data-reveal className="mx-auto mb-6 h-10 w-10 text-primary opacity-0" />
        <h2 data-reveal className="mb-4 font-display text-3xl font-bold tracking-tight opacity-0 sm:text-4xl">
          Haz que el cliente sienta que dejar de pagar es perder progreso
        </h2>
        <p data-reveal className="mx-auto mb-8 max-w-2xl text-muted-foreground opacity-0">
          Cada mes recibe nuevos ajustes, ejercicios priorizados para su objetivo, seguimiento diario y decisiones mas precisas. Esa continuidad es el verdadero producto.
        </p>
        <div data-reveal className="opacity-0">
          <Button variant="hero" size="xl" onClick={() => void onStart()} disabled={ctaLoading}>
            {ctaLoading ? "Redirigiendo..." : "Activar premium por AR$ 11.499/mes"}
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { session, user } = useAuth();
  const [ctaLoading, setCtaLoading] = useState(false);

  const handleStartOffer = async () => {
    if (!session?.access_token || !user?.email) {
      navigate("/registro?checkout=1");
      return;
    }

    setCtaLoading(true);

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
      setCtaLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <OfferTicker />
      <HeroSection ctaLoading={ctaLoading} onStart={handleStartOffer} />
      <FeaturesSection />
      <PricingSection ctaLoading={ctaLoading} onStart={handleStartOffer} />
      <CtaSection ctaLoading={ctaLoading} onStart={handleStartOffer} />
      <footer className="border-t border-border/30 py-8 text-center text-sm text-muted-foreground section-padding">
        {"\u00A9"} 2026 FIT AI SYSTEM. Todos los derechos reservados.
      </footer>
    </div>
  );
}
