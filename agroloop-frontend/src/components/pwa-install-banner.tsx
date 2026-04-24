import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const wasDismissed = localStorage.getItem("pwa-banner-dismissed");
    if (wasDismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setIsVisible(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setIsVisible(false);
      setIsInstalled(true);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setDismissed(true);
    localStorage.setItem("pwa-banner-dismissed", "true");
  };

  if (!isVisible || isInstalled || dismissed) return null;

  return (
    <>
      <div
        onClick={handleDismiss}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 9998,
          animation: "fadeIn 0.3s ease",
        }}
      />

      <div
        style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(90vw, 420px)",
          background: "white",
          borderRadius: "24px",
          padding: "28px 24px",
          zIndex: 9999,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          animation: "slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          fontFamily: "inherit",
        }}
      >
        <button
          onClick={handleDismiss}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "#f5f5f5",
            border: "none",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            cursor: "pointer",
            fontSize: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#666",
          }}
          aria-label="Fermer"
        >
          ✕
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              background: "linear-gradient(135deg, #2E7D32, #4CAF50)",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(46,125,50,0.3)",
            }}
          >
            🌱
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#1a1a1a" }}>
              AgroLoopCI
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#666" }}>
              Installer l'application
            </p>
          </div>
        </div>

        <p
          style={{
            fontSize: "14px",
            color: "#444",
            lineHeight: "1.6",
            margin: "0 0 20px",
            padding: "12px 16px",
            background: "#f8fdf8",
            borderRadius: "12px",
            borderLeft: "3px solid #2E7D32",
          }}
        >
          📲 Installez AgroLoopCI sur votre écran d'accueil pour un accès rapide, même sans connexion.
        </p>

        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
          {["⚡ Rapide", "📴 Hors-ligne", "🔔 Notifications", "🆓 Gratuit"].map((f) => (
            <span
              key={f}
              style={{
                background: "#E8F5E9",
                color: "#2E7D32",
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {f}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handleDismiss}
            style={{
              flex: 1,
              padding: "14px",
              background: "#f5f5f5",
              border: "none",
              borderRadius: "14px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#666",
              cursor: "pointer",
            }}
          >
            Plus tard
          </button>
          <button
            onClick={handleInstall}
            style={{
              flex: 2,
              padding: "14px",
              background: "linear-gradient(135deg, #2E7D32, #4CAF50)",
              border: "none",
              borderRadius: "14px",
              fontSize: "14px",
              fontWeight: 700,
              color: "white",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(46,125,50,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            📲 Installer maintenant
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(100px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}

export default PwaInstallBanner;
