# FIT AI SYSTEM Premium Blueprint

## Producto

FIT AI SYSTEM deja de vender "dietas" y pasa a vender un sistema de progreso fisico con suscripcion mensual unica.

Precio:
- AR$ 11.499 / mes

Principios:
- no hay plan gratis
- no hay dashboard completo sin suscripcion activa
- el valor se percibe en la adaptacion semanal y mensual
- el usuario no paga por texto, paga por continuidad, decisiones y progreso visible

## Flujo real sobre la app actual

1. `Landing`
- CTA directo a registro/login con intencion de checkout
- mensaje central: sistema adaptativo, no dieta

2. `Registro / login`
- autenticacion primero
- luego onboarding premium obligatorio

3. `Onboarding premium`
- wizard por pasos
- guarda perfil base en `fitness_profiles`
- guarda contexto extendido en `onboarding_answers`

4. `Paywall obligatorio`
- si la suscripcion no esta activa, el usuario va a `/suscripcion`
- desde ahi inicia checkout

5. `Pago`
- Stripe activa `subscriptions`
- webhook sincroniza estado

6. `Acceso`
- dashboard solo para auth + onboarding completo + suscripcion activa

## Capas del sistema

### Frontend

- `Landing.tsx`
  vende el sistema y empuja a conversion
- `Login.tsx` / `Register.tsx`
  autentican y preservan intencion de pago
- `OnboardingForm.tsx`
  captura perfil premium
- `SubscriptionPage.tsx`
  paywall obligatorio
- `Dashboard.tsx`
  centro de uso diario y retencion

### Backend

- Supabase Auth
- Supabase Postgres con RLS
- Stripe subscriptions
- Edge Functions:
  - `generate-plan`
  - `analyze-meals`
  - `ask-coach`
  - siguiente fase:
    - `weekly-adjustment`
    - `generate-shopping-list`
    - `generate-system-summary`

## Tablas actuales y nuevas

### Ya existentes
- `fitness_profiles`
- `generated_plans`
- `subscriptions`
- `nutrition_logs`
- `progress_checkins`
- `ai_consultations`
- `workout_progress`

### Nuevas bases agregadas
- `onboarding_answers`
- `system_versions`
- `shopping_lists`
- `shopping_list_items`
- `body_measurements`
- `progress_logs`
- `progress_photos`
- `notifications`
- `ai_conversations`
- `ai_messages`

## Modelo de retencion

### Diario
- calorias
- macros
- comidas
- entrenamiento
- agua
- pasos
- streak

### Semanal
- check-in obligatorio
- resumen semanal
- ajuste de sistema

### Mensual
- refresh del bloque
- nuevo foco
- nueva narrativa de progreso

## Reglas de acceso

- auth ausente:
  - redirect a `/login`
- onboarding incompleto:
  - redirect a `/formulario`
- suscripcion inactiva:
  - redirect a `/suscripcion`
- suscripcion activa:
  - acceso a `/dashboard`

## Siguiente fase tecnica

1. versionado real de planes
2. ajustes semanales automáticos con Edge Function
3. lista de compras basada en plan
4. progreso visual con medidas y fotos
5. notificaciones y recordatorios
6. media real por ejercicio

## KPI que debe atacar el producto

- activacion a pago
- onboarding completado
- dashboard abierto por dia
- comidas marcadas
- entrenamientos iniciados
- check-in semanal completado
- uso del chat IA
- retencion mensual
