import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export function PendingSignatures() {
  const { user } = useAuth();
  const isProducteur = user?.role === "producteur";
  const { data } = useQuery<any[]>({
    queryKey: ["pending-signatures", isProducteur ? "ventes" : "achats"],
    queryFn: () => customFetch<any[]>(isProducteur ? "/api/transactions/mes-ventes" : "/api/transactions/mes-achats"),
    enabled: !!user,
  });

  // Filter to confirmed transactions then check each contract for unsigned by current role
  const { data: contracts } = useQuery({
    queryKey: ["pending-contracts", data?.map((t) => t.id).join(",")],
    queryFn: async () => {
      const confirmed = (data ?? []).filter((t) => t.status === "confirmée");
      const results = await Promise.all(
        confirmed.map(async (t) => {
          try {
            const c = await customFetch<any>(`/api/contracts/${t.id}`);
            return { tx: t, contract: c };
          } catch { return null; }
        })
      );
      return results.filter(Boolean) as { tx: any; contract: any }[];
    },
    enabled: !!data && data.length > 0,
  });

  const pending = (contracts ?? []).filter(({ contract }) =>
    isProducteur ? !contract.seller_signed_at : !contract.buyer_signed_at
  );
  if (pending.length === 0) return null;

  const first = pending[0];
  return (
    <Card className="border-l-4 border-l-orange-500 bg-orange-50/40 mb-4" data-testid="pending-signatures-banner">
      <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-orange-600 shrink-0" />
          <div>
            <div className="font-medium text-orange-900">
              📄 {pending.length} bon{pending.length > 1 ? "s" : ""} de commande en attente de votre signature
            </div>
            <div className="text-xs text-orange-800/80">Signez pour finaliser la transaction.</div>
          </div>
        </div>
        <Button asChild className="bg-orange-600 hover:bg-orange-700">
          <Link href={`/transactions/${first.tx.id}`} data-testid="link-sign-now">Signer maintenant</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
