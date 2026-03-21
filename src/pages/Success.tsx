import { CheckCircle2 } from "lucide-react";
import PaymentResultLayout from "@/components/PaymentResultLayout";

export default function SuccessPage() {
  return (
    <PaymentResultLayout
      badge="Pago confirmado"
      icon={CheckCircle2}
      title="Pago realizado con exito"
      description="Tu suscripcion premium ya quedo activada. Ahora puedes entrar a tu dashboard y acceder a la dieta completa, la rutina semanal y la experiencia premium desbloqueada."
      actions={[
        { label: "Ir al dashboard", to: "/dashboard", variant: "hero" },
        { label: "Volver al inicio", to: "/", variant: "outline" },
      ]}
    />
  );
}
