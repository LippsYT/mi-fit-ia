import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

type Action = {
  label: string;
  onClick?: () => void | Promise<void>;
  to?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "hero";
};

type PaymentResultLayoutProps = {
  actions: Action[];
  badge: string;
  description: string;
  icon: LucideIcon;
  title: string;
};

export default function PaymentResultLayout({
  actions,
  badge,
  description,
  icon: Icon,
  title,
}: PaymentResultLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(163,255,18,0.16),transparent_36%)]" />

        <div className="container relative mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center section-padding py-12">
          <div className="glass-card glow-primary w-full max-w-xl rounded-3xl p-8 text-center sm:p-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/12">
              <Icon className="h-8 w-8 text-primary" />
            </div>

            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-primary">
              <Dumbbell className="h-3.5 w-3.5" />
              {badge}
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              {description}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {actions.map((action) => {
                if (action.to) {
                  return (
                    <Link key={action.label} to={action.to}>
                      <Button variant={action.variant ?? "default"} size="lg" className="w-full sm:min-w-52">
                        {action.label}
                      </Button>
                    </Link>
                  );
                }

                return (
                  <Button
                    key={action.label}
                    variant={action.variant ?? "default"}
                    size="lg"
                    className="w-full sm:min-w-52"
                    onClick={() => void action.onClick?.()}
                  >
                    {action.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
