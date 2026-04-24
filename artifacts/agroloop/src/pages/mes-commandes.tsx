import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShoppingBag, ArrowRight, Package, XCircle } from "lucide-react";
import { ordersApi, formatFcfa, orderStatusLabel, type Order } from "@/lib/orders-api";

export default function MesCommandesPage() {
  const [filter, setFilter] = useState<string>("tous");
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["orders", "list", filter],
    queryFn: () => ordersApi.list(filter),
  });

  return (
    <div className="w-full max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ShoppingBag className="h-7 w-7 text-emerald-600" />
          Mes commandes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Historique de vos commandes passées auprès des producteurs.</p>
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList>
          <TabsTrigger value="tous">Toutes</TabsTrigger>
          <TabsTrigger value="en_attente">⏳ En attente</TabsTrigger>
          <TabsTrigger value="partiellement_confirmée">🔄 Partielles</TabsTrigger>
          <TabsTrigger value="confirmée">✅ Confirmées</TabsTrigger>
          <TabsTrigger value="annulée">❌ Annulées</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <Card className="border-dashed bg-red-50 border-red-200">
          <CardContent className="p-8 text-center">
            <XCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{(error as any)?.message ?? "Impossible de charger vos commandes."}</p>
            <Button variant="outline" onClick={() => refetch()} className="mt-4">Réessayer</Button>
          </CardContent>
        </Card>
      ) : !data || data.length === 0 ? (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">Aucune commande dans cette catégorie.</p>
            <Link href="/marketplace">
              <Button className="mt-4 gap-2">Explorer la marketplace <ArrowRight className="h-4 w-4" /></Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((o: Order) => {
            const s = orderStatusLabel(o.status);
            return (
              <Link key={o.id} href={`/commandes/${o.id}`} className="block w-full">
                <Card className="hover-elevate cursor-pointer transition-all w-full" data-testid={`order-row-${o.id}`}>
                  <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold">{o.reference}</span>
                        <Badge className={s.color}>{s.emoji} {s.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(o.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        {o.items_count !== undefined && <> · {o.items_count} article{o.items_count > 1 ? "s" : ""}</>}
                        {o.sellers_count !== undefined && <> · {o.sellers_count} vendeur{o.sellers_count > 1 ? "s" : ""}</>}
                        {(o.pending_count ?? 0) > 0 && <> · <span className="text-amber-600 font-medium">{o.pending_count} en attente</span></>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className="font-bold tabular-nums">{formatFcfa(o.total_fcfa)} FCFA</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
