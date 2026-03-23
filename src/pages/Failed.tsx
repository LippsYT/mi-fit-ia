import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PaymentResultLayout from "@/components/PaymentResultLayout";
import { useAuth } from "@/hooks/useAuth";
import { startCheckout } from "@/lib/checkout";
import { toast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";

export default function FailedPage() {
  const navigate = useNavigate();
  const { session, user } = useAuth();

  useEffect(() => {
    trackEvent("checkout_failed_page_viewed");
  }, []);

  const handleRetry = async () => {
    if (!session?.access_token || !user?.email) {
      navigate("/login");
      return;
    }

    try {
      trackEvent("checkout_retry_clicked", { source: "failed_page" });
      const url = await startCheckout({
        accessToken: session.access_token,
        email: user.email,
        userId: user.id,
      });

      window.location.href = url;
    } catch (error: any) {
      console.error("Retry checkout failed from failed page", error);
      toast({
        title: "No se pudo iniciar el pago",
        description: error.message ?? "Error inesperado",
        variant: "destructive",
      });
    }
  };

  return (
    <PaymentResultLayout
      badge="Pago no procesado"
      icon={AlertTriangle}
      title="No se pudo procesar el pago"
      description="Hubo un problema al iniciar o completar el cobro. Revisa tus datos de pago o vuelve a intentarlo para activar el acceso premium."
      actions={[
        { label: "Reintentar pago", onClick: handleRetry, variant: "hero" },
        { label: "Volver al dashboard", to: "/dashboard", variant: "outline" },
      ]}
    />
  );
}
