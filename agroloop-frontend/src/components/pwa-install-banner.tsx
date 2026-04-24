import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);

    setIsIos(ios);
    setIsStandalone(standalone);

    const stored = sessionStorage.getItem("pwa-banner-dismissed");
    if (stored) setDismissed(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("pwa-banner-dismissed", "1");
  };

  if (isStandalone || dismissed) return null;

  // Android/Chrome — show native install prompt
  if (prompt) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
        <div className="m-3 rounded-2xl border bg-card shadow-lg p-4 flex items-center gap-3">
          <img src="/brand/agroloop-icon.png" alt="AgroLoopCI" className="h-10 w-10 rounded-xl shrink-0" loading="eager" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Installer AgroLoop</p>
            <p className="text-xs text-muted-foreground truncate">Accès rapide depuis votre écran d'accueil</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={handleInstall} className="gap-1.5 h-8 text-xs">
              <Download className="h-3.5 w-3.5" />
              Installer
            </Button>
            <button
              onClick={handleDismiss}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // iOS — show manual instructions (Safari doesn't support beforeinstallprompt)
  if (isIos) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
        <div className="m-3 rounded-2xl border bg-card shadow-lg p-4 flex items-start gap-3">
          <img src="/brand/agroloop-icon.png" alt="AgroLoopCI" className="h-10 w-10 rounded-xl shrink-0 mt-0.5" loading="eager" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Installer AgroLoop sur iPhone</p>
            <p className="text-xs text-muted-foreground mt-1">
              Appuyez sur <span className="inline-block">⎋</span> <strong>Partager</strong>, puis{" "}
              <strong>Sur l'écran d'accueil</strong>
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted shrink-0"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
