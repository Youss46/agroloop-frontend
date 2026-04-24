import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@/api-client";
import { useAuth } from "@/components/auth-provider";
import { ShieldCheck, Clock, X } from "lucide-react";

type VerifData = {
  verificationStatus?: string;
  verificationLevel?: number;
};

export function VerificationBanner() {
  const { user, token } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const { data } = useQuery<VerifData>({
    queryKey: ["verification-status"],
    queryFn: () => customFetch<VerifData>("/api/verification/status", { method: "GET" }),
    enabled: !!token,
  });

  if (!user || dismissed) return null;

  const status = data?.verificationStatus ?? "non_verifie";

  if (status === "identite_verifie" || status === "professionnel_verifie") {
    return null;
  }

  if (status === "en_attente") {
    return (
      <div
        className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-4 flex items-start gap-3"
        data-testid="banner-verification-pending"
      >
        <Clock className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900">Vérification en cours</p>
          <p className="text-sm text-blue-800 mt-0.5">
            Nous examinons vos documents. Vous recevrez une notification dès que votre compte sera vérifié.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 flex items-start gap-3"
      data-testid="banner-verification-required"
    >
      <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-900">Vérifiez votre compte</p>
        <p className="text-sm text-amber-800 mt-0.5">
          Validez votre identité pour rassurer vos partenaires et débloquer toutes les fonctionnalités.{" "}
          <Link href="/verification" className="font-medium underline hover:no-underline" data-testid="link-banner-verify">
            Commencer maintenant
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Fermer"
        className="text-amber-700 hover:text-amber-900 shrink-0"
        data-testid="button-banner-dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
