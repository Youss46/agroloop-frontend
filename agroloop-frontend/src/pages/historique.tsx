import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { History, FileText, Package, ShoppingCart, User as UserIcon, Calendar, MapPin, AlertCircle, Receipt } from "lucide-react";
import { historiqueApi, type TransactionHistoryRow } from "@/lib/buyer-state-api";
import { useAuth } from "@/components/auth-provider";

const fmt = new Intl.NumberFormat("fr-CI");

function SourceBadge({ source }: { source: TransactionHistoryRow["source"] }) {
  if (source === "devis") return <Badge variant="outline" className="gap-1 border-emerald-600 text-emerald-700"><FileText className="h-3 w-3" /> Via devis</Badge>;
  if (source === "commande") return <Badge variant="outline" className="gap-1 border-blue-600 text-blue-700"><ShoppingCart className="h-3 w-3" /> Via panier</Badge>;
  return <Badge variant="outline" className="gap-1 border-muted-foreground text-muted-foreground"><Package className="h-3 w-3" /> Commande directe</Badge>;
}

export default function Historique() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery<TransactionHistoryRow[]>({
    queryKey: ["transactions", "historique"],
    queryFn: () => historiqueApi.list(),
  });

  if (isError) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 max-w-6xl">
        <Card className="border-destructive/50">
          <CardContent className="py-8 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm text-muted-foreground">Impossible de charger l'historique.</p>
            <Button variant="outline" onClick={() => refetch()}>Réessayer</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <History className="h-7 w-7 text-primary" /> Historique des transactions
        </h1>
        <p className="text-muted-foreground mt-1">Toutes vos transactions confirmées, quelle que soit leur origine.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : !data || data.length === 0 ? (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground">Aucune transaction confirmée</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Vos transactions apparaîtront ici une fois confirmées.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((tx: TransactionHistoryRow) => {
            const otherParty = tx.role === "acheteur" ? tx.sellerName : tx.buyerName;
            const reference = tx.devisReference ?? tx.orderReference ?? `TX-${tx.id}`;
            return (
              <Card key={tx.id} className="border-none shadow-sm ring-1 ring-border/50 hover:shadow-md transition-shadow" data-testid={`card-historique-${tx.id}`}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-lg text-foreground">{tx.typeResidu}</span>
                        <SourceBadge source={tx.source} />
                        <Badge variant="secondary" className="text-xs">
                          {tx.role === "acheteur" ? "Acheteur" : "Vendeur"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" /> {otherParty}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {tx.region}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(tx.createdAt).toLocaleDateString('fr-FR')}</span>
                        <span className="font-mono text-xs">{reference}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 md:flex-col md:items-end md:gap-0">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">{fmt.format(tx.quantityKg)} kg</div>
                        <div className="font-bold text-lg text-primary">{fmt.format(tx.totalFcfa)} FCFA</div>
                      </div>
                      <Link href={`/transactions/${tx.id}`}>
                        <Button variant="outline" size="sm" data-testid={`button-historique-view-${tx.id}`}>
                          Détails
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
