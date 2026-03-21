type StartCheckoutInput = {
  accessToken: string;
  email: string;
  userId: string;
};

export async function startCheckout({ accessToken, email, userId }: StartCheckoutInput) {
  const response = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ userId, email }),
  });

  const rawText = await response.text();
  let payload: { error?: string; url?: string } = {};

  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch (parseError) {
    console.error("Checkout endpoint returned non-JSON response", {
      parseError,
      rawText,
      status: response.status,
    });
    throw new Error("El backend de pago devolvio una respuesta invalida");
  }

  if (!response.ok) {
    console.error("Error create-checkout-session", payload);
    throw new Error(payload.error ?? "No se pudo crear la sesion de checkout");
  }

  if (!payload.url) {
    throw new Error("Stripe no devolvio una URL de checkout");
  }

  return payload.url;
}
