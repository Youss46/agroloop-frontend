import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isInStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function PwaInstallBanner() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;

    const wasDismissed = sessionStorage.getItem("pwa-banner-dismissed");
    if (wasDismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const timer = setTimeout(() => setIsVisible(true), 4000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") {
        setIsVisible(false);
      }
    } else if (isIOS()) {
      setShowIOSGuide(true);
    } else {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setShowIOSGuide(false);
    sessionStorage.setItem("pwa-banner-dismissed", "true");
  };

  if (!isVisible) return null;

  return (
    <>
      <div
        onClick={handleDismiss}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
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
          width: "min(92vw, 420px)",
          background: "white",
          borderRadius: "24px",
          padding: "28px 24px 24px",
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
            top: "14px",
            right: "14px",
            background: "#f0f0f0",
            border: "none",
            borderRadius: "50%",
            width: "30px",
            height: "30px",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#666",
          }}
          aria-label="Fermer"
        >
          ✕
        </button>

        {!showIOSGuide ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "14px" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  background: "linear-gradient(135deg, #2E7D32, #4CAF50)",
                  borderRadius: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                  flexShrink: 0,
                  boxShadow: "0 4px 12px rgba(46,125,50,0.3)",
                }}
              >
                🌱
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#1a1a1a" }}>
                  AgroLoopCI
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#777" }}>
                  Installer l'application gratuitement
                </p>
              </div>
            </div>

            <p
              style={{
                fontSize: "13px",
                color: "#444",
                lineHeight: "1.6",
                margin: "0 0 16px",
                padding: "10px 14px",
                background: "#f4fdf4",
                borderRadius: "10px",
                borderLeft: "3px solid #2E7D32",
              }}
            >
              📲 Accédez à la marketplace même hors-ligne. Rapide, gratuit, aucun store nécessaire.
            </p>

            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              {["⚡ Rapide", "📴 Hors-ligne", "🔔 Notifications", "🆓 Gratuit"].map((f) => (
                <span
                  key={f}
                  style={{
                    background: "#E8F5E9",
                    color: "#2E7D32",
                    padding: "3px 10px",
                    borderRadius: "20px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {f}
                </span>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleDismiss}
                style={{
                  flex: 1,
                  padding: "13px",
                  background: "#f0f0f0",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "13px",
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
                  padding: "13px",
                  background: "linear-gradient(135deg, #2E7D32, #4CAF50)",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "white",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(46,125,50,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                📲 Installer maintenant
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: 700, color: "#1a1a1a" }}>
              📲 Comment installer AgroLoopCI
            </h3>
            {isIOS() ? (
              <ol style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", color: "#333", lineHeight: "2" }}>
                <li>Appuyez sur <strong>⬆ Partager</strong> en bas de Safari</li>
                <li>Faites défiler et appuyez sur <strong>« Sur l'écran d'accueil »</strong></li>
                <li>Appuyez sur <strong>Ajouter</strong> en haut à droite</li>
              </ol>
            ) : (
              <ol style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", color: "#333", lineHeight: "2" }}>
                <li>Appuyez sur <strong>⋮</strong> (menu Chrome en haut à droite)</li>
                <li>Appuyez sur <strong>« Ajouter à l'écran d'accueil »</strong></li>
                <li>Appuyez sur <strong>Ajouter</strong> pour confirmer</li>
              </ol>
            )}
            <button
              onClick={handleDismiss}
              style={{
                marginTop: "18px",
                width: "100%",
                padding: "13px",
                background: "linear-gradient(135deg, #2E7D32, #4CAF50)",
                border: "none",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: 700,
                color: "white",
                cursor: "pointer",
              }}
            >
              Compris !
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(120px); opacity: 0; }
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
