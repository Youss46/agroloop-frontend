import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, FileText, Package, AlertTriangle, Clock } from "lucide-react";
import { dashboardApi, type PendingCounts } from "@/lib/buyer-state-api";

function Row({
  icon, label, count, href, testId, variant,
}: {
  icon: React.ReactNode; label: string; count: number; href: string; testId: string;
  variant?: "default" | "danger";
}) {
  const countColor = variant === "danger" && count > 0
    ? "text-red-600"
    : count > 0 ? "text-primary" : "text-muted-foreground";
  return (
    <Link
      href={href}
      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
      data-testid={testId}
    >
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">{icon}</span>
        <span className="font-medium">{label}</span>
      </div>
      <span className={`text-xl font-bold tabular-nums ${countColor}`}>{count}</span>
    </Link>
  );
}

export function PendingActionsWidget() {
  const { data, isLoading } = useQuery<PendingCounts>({
    queryKey: ["dashboard", "pending-counts"],
    queryFn: () => dashboardApi.getPendingCounts(),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card className="mb-6 border-none shadow-sm ring-1 ring-border/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  if (data.role === "transformateur") {
    const nothing = data.cartCount === 0 && data.devisPending === 0 && data.ordersInProgress === 0 && data.counterProposalsDevis === 0 && data.counterProposalsCommandes === 0;
    return (
      <Card className="mb-6 border-none shadow-sm ring-1 ring-border/50" data-testid="widget-pending-transformateur">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Mes achats en cours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {nothing ? (
            <p className="text-sm text-muted-foreground py-2 px-3">Aucune action en attente.</p>
          ) : (
            <>
              <Row icon={<ShoppingCart className="h-4 w-4" />} label="Articles dans le panier" count={data.cartCount} href="/panier" testId="widget-row-cart" />
              <Row icon={<FileText className="h-4 w-4" />} label="Devis en attente de réponse" count={data.devisPending} href="/devis/mes-devis" testId="widget-row-devis-pending" />
              <Row icon={<Package className="h-4 w-4" />} label="Commandes en cours" count={data.ordersInProgress} href="/commandes" testId="widget-row-orders" />
              {data.counterProposalsDevis > 0 && (
                <Row icon={<AlertTriangle className="h-4 w-4" />} label="Contre-propositions sur devis" count={data.counterProposalsDevis} href="/devis/mes-devis" testId="widget-row-counter-devis" variant="danger" />
              )}
              {data.counterProposalsCommandes > 0 && (
                <Row icon={<AlertTriangle className="h-4 w-4" />} label="Contre-propositions sur commandes" count={data.counterProposalsCommandes} href="/commandes" testId="widget-row-counter-commandes" variant="danger" />
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // producteur
  const nothing = data.devisReceived === 0 && data.ordersReceived === 0 && data.expiringSoonDevis === 0 && data.expiringSoonCommandes === 0;
  return (
    <Card className="mb-6 border-none shadow-sm ring-1 ring-border/50" data-testid="widget-pending-producteur">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Demandes reçues
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {nothing ? (
          <p className="text-sm text-muted-foreground py-2 px-3">Aucune demande en attente.</p>
        ) : (
          <>
            <Row icon={<FileText className="h-4 w-4" />} label="Devis à traiter" count={data.devisReceived} href="/devis/recus" testId="widget-row-devis-recus" />
            <Row icon={<Package className="h-4 w-4" />} label="Commandes à confirmer" count={data.ordersReceived} href="/commandes/recues" testId="widget-row-orders-recues" />
            {data.expiringSoonDevis > 0 && (
              <Row icon={<AlertTriangle className="h-4 w-4" />} label="Devis expirent dans moins de 6h" count={data.expiringSoonDevis} href="/devis/recus" testId="widget-row-expiring-devis" variant="danger" />
            )}
            {data.expiringSoonCommandes > 0 && (
              <Row icon={<AlertTriangle className="h-4 w-4" />} label="Commandes expirent dans moins de 6h" count={data.expiringSoonCommandes} href="/commandes/recues" testId="widget-row-expiring-commandes" variant="danger" />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
