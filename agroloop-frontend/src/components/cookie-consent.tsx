import { useState, useEffect } from "react";
import { getConsent, setConsent } from "@/lib/analytics";
import { Cookie } from "lucide-react";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = getConsent();
    if (consent === null) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;

  function handleAccept() {
    setConsent("granted");
    setVisible(false);
  }

  function handleRefuse() {
    setConsent("denied");
    setVisible(false);
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 bg-white border border-border rounded-xl shadow-lg p-4 flex flex-col gap-3 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 bg-amber-100 p-1.5 rounded-md">
          <Cookie className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Cookies & Confidentialité</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Nous utilisons des cookies pour améliorer votre expérience et analyser notre trafic. Vos données restent anonymisées.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-2 px-3 rounded-md transition-colors"
        >
          Accepter
        </button>
        <button
          onClick={handleRefuse}
          className="flex-1 bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-medium py-2 px-3 rounded-md transition-colors"
        >
          Refuser
        </button>
      </div>
    </div>
  );
}
