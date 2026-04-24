import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, Leaf } from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const dateFR = (s: string) => new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function VerifierPage() {
  const [, params] = useRoute("/verifier/:reference");
  const reference = params?.reference ?? "";

  const q = useQuery({
    queryKey: ["verify", reference],
    queryFn: () => customFetch<any>(`/api/verify/${encodeURIComponent(reference)}`),
    enabled: !!reference,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white py-12 px-4" data-testid="verifier-page">
      <div className="max-w-md mx-auto text-center space-y-6">
        <div className="flex items-center justify-center gap-2 text-green-700">
          <Leaf className="h-7 w-7" />
          <span className="text-2xl font-bold">AgroLoopCI</span>
        </div>

        {q.isLoading && <Skeleton className="h-48 w-full" />}

        {!q.isLoading && q.data && (
          q.data.valid ? (
            <Card className="border-green-200 shadow-md">
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-full bg-green-100 p-4">
                    <Check className="h-12 w-12 text-green-600" data-testid="icon-valid" />
                  </div>
                  <h1 className="text-xl font-bold text-green-700" data-testid="title-valid">Contrat authentique vérifié</h1>
                </div>
                <div className="text-left text-sm space-y-2 border-t pt-4">
                  <Row label="Référence" value={<span className="font-mono" data-testid="text-reference">{q.data.reference}</span>} />
                  <Row label="Vendeur" value={q.data.seller_name} />
                  <Row label="Acheteur" value={q.data.buyer_name} />
                  <Row label="Type de résidu" value={q.data.type_residu} />
                  <Row label="Quantité" value={`${fmt(q.data.quantity_kg)} kg`} />
                  <Row label="Date" value={dateFR(q.data.generated_at)} />
                  <Row label="Signatures" value={
                    q.data.signatures_status.both ? "✓ Signé par les deux parties"
                      : q.data.signatures_status.seller ? "Signé par le vendeur"
                      : q.data.signatures_status.buyer ? "Signé par l'acheteur"
                      : "Aucune signature"
                  } />
                </div>
                <Link href="/" className="inline-block mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                  Voir sur AgroLoopCI
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-red-200 shadow-md">
              <CardContent className="p-6 space-y-3">
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-full bg-red-100 p-4">
                    <X className="h-12 w-12 text-red-600" data-testid="icon-invalid" />
                  </div>
                  <h1 className="text-xl font-bold text-red-700" data-testid="title-invalid">Référence introuvable</h1>
                  <p className="text-sm text-muted-foreground font-mono">{reference}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Aucun bon de commande ne correspond à cette référence dans notre système.
                </p>
              </CardContent>
            </Card>
          )
        )}

        <p className="text-xs text-muted-foreground">
          Cette page permet de vérifier l'authenticité d'un bon de commande AgroLoopCI.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label} :</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
