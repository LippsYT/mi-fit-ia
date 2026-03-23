import { track } from "@vercel/analytics";

type AnalyticsValue = boolean | null | number | string | undefined;

export function trackEvent(name: string, properties?: Record<string, AnalyticsValue>) {
  try {
    track(name, properties);
  } catch (error) {
    console.error("Analytics event failed", { error, name, properties });
  }
}
