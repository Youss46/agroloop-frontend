import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Clock, Package, ArrowRight, XCircle } from "lucide-react";
import { ordersApi, formatFcfa } from "@/lib/orders-api";

export default function CommandeConfirmationPage() {
  const [, params] = useRoute("/commandes/confirmation/:id");
  const id = Number(params?.id);

  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["orders", "detail", id],
    queryFn: () => ordersApi.detail(id),
    enabled: Number.isFinite(id),
  });

  if (isLoading) {
    return (
      <div className="container py-10 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="container py-10 max-w-xl">
        <Card className="border-dashed bg-red-50 border-red-200">
          <CardContent className="p-8 text-center">
            <XCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h2 className="font-semibold text-lg">Impossible de charger la commande</h2>
            <p className="text-sm text-muted-foreground mt-1">{(error as any)?.message ?? "Réessayez ou consultez vos commandes."}</p>
            <div className="flex gap-2 justify-center mt-4">
              <Button variant="outline" onClick={() => refetch()}>Réessayer</Button>
              <Link href="/commandes"><Button>Mes commandes</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sellerCount = new Set(order.items.map((i: { producteur_id: number }) => i.producteur_id)).size;

  return (
    <div className="container py-10 max-w-2xl">
      <Card>
        <CardContent className="p-8 text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4 animate-in zoom-in-50">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Commande envoyée ! 🎉</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Votre commande a bien été transmise aux vendeurs.
          </p>

          <div className="mt-6 rounded-lg border bg-muted/30 p-4 text-left">
            <div className="text-xs text-muted-foreground">Référence</div>
            <div className="font-mono font-semibold text-lg" data-testid="text-order-reference">{order.reference}</div>
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Vendeurs contactés</div>
                <div className="font-semibold">{sellerCount}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total estimé</div>
                <div className="font-semibold tabular-nums">{formatFcfa(order.total_fcfa)} FCFA</div>
              </div>
            </div>
          </div>

          <ol className="mt-6 text-left space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Commande envoyée</div>
                <div className="text-xs text-muted-foreground">Les vendeurs ont été notifiés</div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">En attente de réponse</div>
                <div className="text-xs text-muted-foreground">Les vendeurs ont 48h pour répondre</div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Package className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Confirmation et contrats</div>
                <div className="text-xs text-muted-foreground">Génération automatique des contrats à chaque acceptation</div>
              </div>
            </li>
          </ol>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={`/commandes/${order.id}`}>
              <Button className="w-full sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-700" data-testid="button-track-order">
                <ArrowRight className="h-4 w-4" />
                Suivre ma commande
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="outline" className="w-full sm:w-auto">Retour à la marketplace</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
