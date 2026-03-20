import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dumbbell, RefreshCw, User, Lock, Utensils, Calendar } from "lucide-react";

interface UserProfile {
  peso: string;
  altura: string;
  edad: string;
  genero: string;
  objetivo: string;
  actividad: string;
  dias: string;
}

const sampleDiet = [
  { meal: "Desayuno", items: "Avena con plátano, claras de huevo revueltas, café negro", cal: "420 kcal" },
  { meal: "Media mañana", items: "Yogur griego con almendras y arándanos", cal: "250 kcal" },
  { meal: "Almuerzo", items: "Pechuga de pollo a la plancha, arroz integral, ensalada mixta", cal: "550 kcal" },
  { meal: "Merienda", items: "Batido de proteína con leche de almendras", cal: "200 kcal" },
  { meal: "Cena", items: "Salmón al horno con brócoli y batata", cal: "480 kcal" },
];

const sampleRoutine = [
  { day: "Lunes", focus: "Pecho y Tríceps", exercises: "Press banca 4×10, Aperturas 3×12, Fondos 3×12, Extensiones tríceps 3×15" },
  { day: "Martes", focus: "Espalda y Bíceps", exercises: "Dominadas 4×8, Remo con barra 4×10, Curl bíceps 3×12, Curl martillo 3×12" },
  { day: "Miércoles", focus: "Descanso activo", exercises: "Cardio ligero 30 min, Estiramientos" },
  { day: "Jueves", focus: "Piernas", exercises: "Sentadillas 4×10, Prensa 4×12, Extensiones 3×15, Curl femoral 3×12" },
  { day: "Viernes", focus: "Hombros y Core", exercises: "Press militar 4×10, Elevaciones laterales 3×15, Plancha 3×60s, Crunch 3×20" },
];

export default function Dashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<"dieta" | "rutina">("dieta");
  const [isSubscribed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("fitai_profile");
    if (stored) setProfile(JSON.parse(stored));
  }, []);

  const objectiveLabels: Record<string, string> = {
    "perder-peso": "Perder peso",
    "ganar-musculo": "Ganar músculo",
    "tonificar": "Tonificar",
    "mantener": "Mantener peso",
  };

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between section-padding">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
            <Dumbbell className="h-6 w-6 text-primary" />
            <span>FIT AI</span>
            <span className="text-primary">SYSTEM</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/formulario">
              <Button variant="ghost" size="sm"><User className="mr-1 h-4 w-4" />Editar datos</Button>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="sm">Salir</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto section-padding py-8">
        {/* Profile summary */}
        {profile && (
          <div className="mb-8 glass-card rounded-xl p-6">
            <h2 className="mb-3 font-display text-lg font-semibold">Tu perfil</h2>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><span className="text-muted-foreground">Peso:</span> <span className="font-medium">{profile.peso} kg</span></div>
              <div><span className="text-muted-foreground">Altura:</span> <span className="font-medium">{profile.altura} cm</span></div>
              <div><span className="text-muted-foreground">Edad:</span> <span className="font-medium">{profile.edad} años</span></div>
              <div><span className="text-muted-foreground">Objetivo:</span> <span className="font-medium">{objectiveLabels[profile.objetivo] || profile.objetivo}</span></div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <Button
            variant={activeTab === "dieta" ? "default" : "secondary"}
            onClick={() => setActiveTab("dieta")}
            size="sm"
          >
            <Utensils className="mr-1 h-4 w-4" />Plan de dieta
          </Button>
          <Button
            variant={activeTab === "rutina" ? "default" : "secondary"}
            onClick={() => setActiveTab("rutina")}
            size="sm"
          >
            <Calendar className="mr-1 h-4 w-4" />Rutina semanal
          </Button>
        </div>

        {/* Content */}
        <div className="relative">
          {activeTab === "dieta" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">Tu Plan de Dieta</h2>
                <Button variant="outline" size="sm" disabled={!isSubscribed}>
                  <RefreshCw className="mr-1 h-4 w-4" />Regenerar
                </Button>
              </div>
              {sampleDiet.map((meal, i) => (
                <div key={i} className="glass-card rounded-xl p-5">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-display font-semibold text-primary">{meal.meal}</h3>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">{meal.cal}</span>
                  </div>
                  <p className={`text-sm ${!isSubscribed && i > 1 ? "blur-sm select-none" : ""}`}>
                    {meal.items}
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeTab === "rutina" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">Tu Rutina Semanal</h2>
                <Button variant="outline" size="sm" disabled={!isSubscribed}>
                  <RefreshCw className="mr-1 h-4 w-4" />Regenerar
                </Button>
              </div>
              {sampleRoutine.map((day, i) => (
                <div key={i} className="glass-card rounded-xl p-5">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-display font-semibold">{day.day}</h3>
                    <span className="text-xs font-medium text-primary">{day.focus}</span>
                  </div>
                  <p className={`text-sm text-muted-foreground ${!isSubscribed && i > 1 ? "blur-sm select-none" : ""}`}>
                    {day.exercises}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Paywall overlay */}
          {!isSubscribed && (
            <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-background via-background/95 to-transparent flex flex-col items-center justify-end pb-8">
              <Lock className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-display text-lg font-bold">Desbloquea tu plan completo</h3>
              <p className="mb-4 text-sm text-muted-foreground">Suscríbete por solo $7/mes</p>
              <Button variant="hero" size="lg">Suscribirse ahora</Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
