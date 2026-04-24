declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

const CONSENT_KEY = "analytics_consent";
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

export function getConsent(): "granted" | "denied" | null {
  const stored = localStorage.getItem(CONSENT_KEY);
  if (stored === "granted" || stored === "denied") return stored;
  return null;
}

export function setConsent(value: "granted" | "denied"): void {
  localStorage.setItem(CONSENT_KEY, value);
  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", {
      analytics_storage: value,
    });
  }
  if (value === "granted" && GA_ID) {
    loadGA4Script(GA_ID);
  }
}

function loadGA4Script(id: string): void {
  if (document.getElementById("ga4-script")) return;
  const script = document.createElement("script");
  script.id = "ga4-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);
  if (typeof window.gtag === "function") {
    window.gtag("config", id);
  }
}

export function initAnalytics(): void {
  const consent = getConsent();
  if (consent === "granted" && GA_ID) {
    loadGA4Script(GA_ID);
  }
  if (typeof window.gtag === "function") {
    window.gtag("consent", "default", {
      analytics_storage: consent === "granted" ? "granted" : "denied",
    });
  }
}

export function trackPageView(path: string): void {
  if (typeof window.gtag !== "function" || !GA_ID) return;
  if (getConsent() !== "granted") return;
  window.gtag("config", GA_ID, { page_path: path });
}

export function trackEvent(
  action: string,
  category: string,
  label?: string,
  value?: number,
): void {
  if (typeof window.gtag !== "function") return;
  if (getConsent() !== "granted") return;
  window.gtag("event", action, {
    event_category: category,
    event_label: label,
    value,
  });
}
