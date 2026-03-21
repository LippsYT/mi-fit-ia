import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dumbbell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const objectives = [
  { value: "bajar_grasa", label: "Bajar grasa" },
  { value: "ganar_musculo", label: "Ganar musculo" },
  { value: "mantenerme", label: "Mantenerme en forma" },
];

const activityLevels = [
  { value: "sedentario", label: "Sedentario" },
  { value: "ligero", label: "Actividad ligera" },
  { value: "moderado", label: "Moderado" },
  { value: "alto", label: "Alto" },
];

type FormState = {
  activity_level: string;
  age: string;
  gender: string;
  goal: string;
  height: string;
  training_days: string;
  weight: string;
};

const initialForm: FormState = {
  activity_level: "",
  age: "",
  gender: "",
  goal: "",
  height: "",
  training_days: "",
  weight: "",
};

export default function OnboardingForm() {
  const navigate = useNavigate();
  const { loading: authLoading, user } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from("fitness_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error cargando fitness_profiles", error);
      }

      if (data) {
        setForm({
          activity_level: data.activity_level ?? "",
          age: data.age ? String(data.age) : "",
          gender: data.gender ?? "",
          goal: data.goal ?? "",
          height: data.height ? String(data.height) : "",
          training_days: data.training_days ? String(data.training_days) : "",
          weight: data.weight ? String(data.weight) : "",
        });
      }

      setLoadingProfile(false);
    };

    void loadProfile();
  }, [authLoading, navigate, user]);

  const update = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const currentUser = user ?? (await supabase.auth.getUser()).data.user;
    if (!currentUser) {
      toast({ title: "Debes iniciar sesion", variant: "destructive" });
      navigate("/login", { replace: true });
      return;
    }

    setLoading(true);

    const payload = {
      user_id: currentUser.id,
      weight: Number(form.weight),
      height: Number(form.height),
      age: Number(form.age),
      gender: form.gender,
      goal: form.goal,
      activity_level: form.activity_level,
      training_days: Number(form.training_days),
    };

    const { error } = await supabase
      .from("fitness_profiles")
      .upsert(payload, { onConflict: "user_id" });

    setLoading(false);

    if (error) {
      console.error("Error guardando fitness_profiles", error, payload);
      toast({
        title: "Error guardando tu perfil",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    navigate("/dashboard", { replace: true });
  };

  if (authLoading || loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center section-padding py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center justify-center gap-2 font-display text-xl font-bold tracking-tight">
          <Dumbbell className="h-6 w-6 text-primary" />
          <span>FIT AI</span>
          <span className="text-primary">SYSTEM</span>
        </div>

        <div className="glass-card rounded-2xl p-8">
          <h1 className="mb-1 font-display text-2xl font-bold">Cuentanos sobre ti</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Guardaremos estos datos para personalizar tu dieta y tu rutina.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Peso (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="75"
                  value={form.weight}
                  onChange={(event) => update("weight", event.target.value)}
                  required
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Altura (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  placeholder="175"
                  value={form.height}
                  onChange={(event) => update("height", event.target.value)}
                  required
                  className="bg-background/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age">Edad</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="28"
                  value={form.age}
                  onChange={(event) => update("age", event.target.value)}
                  required
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Genero</Label>
                <Select value={form.gender} onValueChange={(value) => update("gender", value)}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="femenino">Femenino</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Select value={form.goal} onValueChange={(value) => update("goal", value)}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Que quieres lograr?" />
                </SelectTrigger>
                <SelectContent>
                  {objectives.map((objective) => (
                    <SelectItem key={objective.value} value={objective.value}>
                      {objective.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nivel de actividad</Label>
              <Select value={form.activity_level} onValueChange={(value) => update("activity_level", value)}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Cuan activo eres?" />
                </SelectTrigger>
                <SelectContent>
                  {activityLevels.map((activity) => (
                    <SelectItem key={activity.value} value={activity.value}>
                      {activity.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dias disponibles para entrenar</Label>
              <Select value={form.training_days} onValueChange={(value) => update("training_days", value)}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6].map((days) => (
                    <SelectItem key={days} value={String(days)}>
                      {days} dias
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Generar mi plan con IA"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
