import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dumbbell, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const objectives = [
  { value: "perder-peso", label: "Perder peso" },
  { value: "ganar-musculo", label: "Ganar músculo" },
  { value: "tonificar", label: "Tonificar" },
  { value: "mantener", label: "Mantener peso" },
];

const activityLevels = [
  { value: "sedentario", label: "Sedentario" },
  { value: "ligero", label: "Actividad ligera" },
  { value: "moderado", label: "Moderado" },
  { value: "activo", label: "Muy activo" },
];

export default function OnboardingForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    peso: "",
    altura: "",
    edad: "",
    genero: "",
    objetivo: "",
    actividad: "",
    dias: "",
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Debes iniciar sesión", variant: "destructive" });
      navigate("/login");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("profiles").update({
      peso: parseFloat(form.peso),
      altura: parseFloat(form.altura),
      edad: parseInt(form.edad),
      genero: form.genero,
      objetivo: form.objetivo,
      actividad: form.actividad,
      dias: parseInt(form.dias),
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);

    setLoading(false);

    if (error) {
      toast({ title: "Error guardando perfil", description: error.message, variant: "destructive" });
      return;
    }

    navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center section-padding py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center justify-center gap-2 font-display text-xl font-bold tracking-tight">
          <Dumbbell className="h-6 w-6 text-primary" />
          <span>FIT AI</span>
          <span className="text-primary">SYSTEM</span>
        </div>

        <div className="glass-card rounded-2xl p-8">
          <h1 className="mb-1 font-display text-2xl font-bold">Cuéntanos sobre ti</h1>
          <p className="mb-6 text-sm text-muted-foreground">Necesitamos estos datos para generar tu plan personalizado</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="peso">Peso (kg)</Label>
                <Input id="peso" type="number" placeholder="75" value={form.peso} onChange={(e) => update("peso", e.target.value)} required className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="altura">Altura (cm)</Label>
                <Input id="altura" type="number" placeholder="175" value={form.altura} onChange={(e) => update("altura", e.target.value)} required className="bg-background/50" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edad">Edad</Label>
                <Input id="edad" type="number" placeholder="28" value={form.edad} onChange={(e) => update("edad", e.target.value)} required className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label>Género</Label>
                <Select value={form.genero} onValueChange={(v) => update("genero", v)}>
                  <SelectTrigger className="bg-background/50"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
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
              <Select value={form.objetivo} onValueChange={(v) => update("objetivo", v)}>
                <SelectTrigger className="bg-background/50"><SelectValue placeholder="¿Qué quieres lograr?" /></SelectTrigger>
                <SelectContent>
                  {objectives.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nivel de actividad</Label>
              <Select value={form.actividad} onValueChange={(v) => update("actividad", v)}>
                <SelectTrigger className="bg-background/50"><SelectValue placeholder="¿Cuán activo eres?" /></SelectTrigger>
                <SelectContent>
                  {activityLevels.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dias">Días para entrenar por semana</Label>
              <Select value={form.dias} onValueChange={(v) => update("dias", v)}>
                <SelectTrigger className="bg-background/50"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6].map((d) => <SelectItem key={d} value={String(d)}>{d} días</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Generar mi plan con IA"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
