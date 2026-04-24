import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[AgroLoopCI] Erreur composant:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const err = this.state.error;
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 py-8">
          <div className="max-w-2xl w-full text-center">
            <h2 className="text-xl font-semibold mb-2">Une erreur est survenue</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              Un problème inattendu s'est produit. Vous pouvez recharger la page ou retourner à l'accueil.
            </p>
            {err && (
              <details className="mb-6 text-left bg-muted/50 rounded-md p-3 text-xs">
                <summary className="cursor-pointer font-medium text-destructive mb-2">
                  Détails techniques : {err.message || "Erreur inconnue"}
                </summary>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words max-h-64 text-[11px] leading-tight">
                  {err.stack || String(err)}
                </pre>
              </details>
            )}
            <div className="flex gap-2 justify-center flex-wrap">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Recharger la page
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = "/";
                }}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Retour à l'accueil
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
