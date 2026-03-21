import { XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PaymentResultLayout from "@/components/PaymentResultLayout";
import { useAuth } from "@/hooks/useAuth";
import { startCheckout } from "@/lib/checkout";
import { toast } from "@/hooks/use-toast";

export default function CancelPage() {
  const navigate = useNavigate();
  const { session, user } = useAuth();

  const handleRetry = async () => {
    if (!session?.access_token || !user?.email) {
      navigate("/login");
      return;
    }

    try {
      const url = await startCheckout({
        accessToken: session.access_token,
        email: user.email,
        userId: user.id,
      });

      window.location.href = url;
    } catch (error: any) {
      console.error("Retry checkout failed from cancel page", error);
      toast({
        title: "No se pudo reintentar el pago",
        description: error.message ?? "Error inesperado",
        variant: "destructive",
      });
    }
  };

  return (
    <PaymentResultLayout
      badge="Pago cancelado"
      icon={XCircle}
      title="Pago cancelado"
      description="No se realizo ningun cobro. Puedes volver a intentarlo cuando quieras para desbloquear el dashboard premium completo."
      actions={[
        { label: "Reintentar suscripcion", onClick: handleRetry, variant: "hero" },
        { label: "Volver al dashboard", to: "/dashboard", variant: "outline" },
      ]}
    />
  );
}
