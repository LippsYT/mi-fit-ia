import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { Zap, Brain, CalendarDays, TrendingUp, Lock, Smartphone } from "lucide-react";
import heroImage from "@/assets/hero-fitness.jpg";
import Navbar from "@/components/Navbar";

function HeroSection() {
  const ref = useScrollReveal();
  return (
    <section ref={ref} className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img src={heroImage} alt="" className="h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/60" />
      </div>

      <div className="container relative mx-auto section-padding py-20 lg:py-32">
        <div className="max-w-2xl">
          <div data-reveal className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary opacity-0">
            <Zap className="h-4 w-4" />
            Potenciado por Inteligencia Artificial
          </div>

          <h1 data-reveal className="mb-6 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl opacity-0">
            Tu plan fitness personalizado{" "}
            <span className="text-gradient">en segundos</span>
          </h1>

          <p data-reveal className="mb-8 max-w-lg text-lg leading-relaxed text-muted-foreground opacity-0">
            Sin nutricionista. Sin complicaciones. Obtén tu dieta y rutina de entrenamiento adaptada a tus objetivos con IA avanzada.
          </p>

          <div data-reveal className="flex flex-col gap-3 sm:flex-row opacity-0">
            <Link to="/registro">
              <Button variant="hero" size="xl">Empezar ahora</Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="xl">Ya tengo cuenta</Button>
            </Link>
          </div>

          <div data-reveal className="mt-12 flex gap-8 text-sm text-muted-foreground opacity-0">
            <div>
              <span className="block font-display text-2xl font-bold text-foreground tabular-nums">2,847+</span>
              usuarios activos
            </div>
            <div>
              <span className="block font-display text-2xl font-bold text-foreground tabular-nums">94.3%</span>
              satisfacción
            </div>
            <div>
              <span className="block font-display text-2xl font-bold text-foreground tabular-nums">$7</span>
              al mes
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const features = [
  { icon: Brain, title: "IA Personalizada", desc: "Planes generados en segundos según tu cuerpo y objetivos" },
  { icon: CalendarDays, title: "Rutina Semanal", desc: "Entrenamiento organizado día a día, adaptado a tu disponibilidad" },
  { icon: TrendingUp, title: "Seguimiento", desc: "Monitorea tu progreso y ajusta tu plan cuando lo necesites" },
  { icon: Smartphone, title: "Mobile-first", desc: "Accede a tu plan desde cualquier dispositivo, en cualquier momento" },
];

function FeaturesSection() {
  const ref = useScrollReveal();
  return (
    <section ref={ref} className="py-24 lg:py-32">
      <div className="container mx-auto section-padding">
        <div className="mb-16 text-center">
          <h2 data-reveal className="mb-4 font-display text-3xl font-bold tracking-tight sm:text-4xl opacity-0">
            Todo lo que necesitas para{" "}
            <span className="text-gradient">transformarte</span>
          </h2>
          <p data-reveal className="mx-auto max-w-md text-muted-foreground opacity-0">
            Nuestra IA analiza tus datos y crea un plan completo en segundos
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              data-reveal
              className="glass-card rounded-xl p-6 opacity-0 transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-2 font-display text-lg font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const ref = useScrollReveal();
  return (
    <section ref={ref} className="py-24 lg:py-32 bg-secondary/30">
      <div className="container mx-auto section-padding">
        <div className="mx-auto max-w-md text-center">
          <h2 data-reveal className="mb-4 font-display text-3xl font-bold tracking-tight sm:text-4xl opacity-0">
            Un precio simple
          </h2>
          <p data-reveal className="mb-12 text-muted-foreground opacity-0">
            Sin contratos. Cancela cuando quieras.
          </p>

          <div data-reveal className="glass-card glow-primary rounded-2xl p-8 opacity-0">
            <div className="mb-1 text-sm font-medium text-muted-foreground">Plan Premium</div>
            <div className="mb-6 flex items-baseline justify-center gap-1">
              <span className="font-display text-5xl font-bold">$7</span>
              <span className="text-muted-foreground">/mes</span>
            </div>
            <ul className="mb-8 space-y-3 text-left text-sm">
              {[
                "Dieta personalizada con IA",
                "Rutina semanal completa",
                "Regeneración ilimitada de planes",
                "Seguimiento de progreso",
                "Soporte prioritario",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <Zap className="h-4 w-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/registro">
              <Button variant="hero" size="lg" className="w-full">
                Empezar ahora
              </Button>
            </Link>
            <p className="mt-4 text-xs text-muted-foreground">
              Prueba gratuita con vista previa del plan
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  const ref = useScrollReveal();
  return (
    <section ref={ref} className="py-24 lg:py-32">
      <div className="container mx-auto section-padding text-center">
        <Lock data-reveal className="mx-auto mb-6 h-10 w-10 text-primary opacity-0" />
        <h2 data-reveal className="mb-4 font-display text-3xl font-bold tracking-tight sm:text-4xl opacity-0">
          ¿Listo para transformar tu cuerpo?
        </h2>
        <p data-reveal className="mx-auto mb-8 max-w-md text-muted-foreground opacity-0">
          Únete a miles de personas que ya están alcanzando sus metas fitness con IA.
        </p>
        <div data-reveal className="opacity-0">
          <Link to="/registro">
            <Button variant="hero" size="xl">Empezar ahora — $7/mes</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
      <CtaSection />
      <footer className="border-t border-border/30 py-8 text-center text-sm text-muted-foreground section-padding">
        © 2026 FIT AI SYSTEM. Todos los derechos reservados.
      </footer>
    </div>
  );
}
