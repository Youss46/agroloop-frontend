import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { Receipt, Download, ArrowRight, Crown, Sparkles, Zap } from "lucide-react";
import {
  subscriptionsApi, downloadInvoice, PLAN_LABELS, PAYMENT_METHOD_LABELS,
} from "@/lib/subscriptions-api";

const FCFA = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export default function MonComptePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["subscription-me"],
    queryFn: () => subscriptionsApi.me(),
    enabled: !!user,
  });

  const { data: invoices, isLoading: invLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => subscriptionsApi.invoices(),
    enabled: !!user,
  });

  if (!user) return null;

  const Icon = me?.plan.name === "business" ? Crown : me?.plan.name === "pro" ? Sparkles : Zap;
  const isFree = me?.plan.name === "gratuit";

  const handleDownload = async (id: number, ref: string) => {
    try { await downloadInvoice(id, ref); }
    catch (e: any) { toast({ title: "Erreur", description: e?.message ?? "Téléchargement impossible", variant: "destructive" }); }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6" data-testid="mon-compte-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mon compte</h1>
        <p className="text-muted-foreground mt-1">Gérez votre abonnement et vos factures.</p>
      </div>

      <Card className="border-none shadow-sm ring-1 ring-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            Mon abonnement
          </CardTitle>
        </CardHeader>
        <CardContent>
          {meLoading || !me ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">Plan {PLAN_LABELS[me.plan.name]}</span>
                    {!isFree && me.subscription?.status === "active" && (
                      <Badge className="bg-primary">Actif</Badge>
                    )}
                    {me.subscription?.status === "cancelled" && (
                      <Badge variant="outline" className="border-amber-300 text-amber-700">Annulé</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {me.plan.price_fcfa === 0 ? "Gratuit" : `${FCFA(me.plan.price_fcfa)} FCFA / mois`}
                  </p>
                  {me.subscription && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {me.subscription.status === "cancelled" ? "Accès jusqu'au " : "Renouvellement le "}
                      <strong>{new Date(me.subscription.expires_at).toLocaleDateString("fr-FR")}</strong>
                    </p>
                  )}
                </div>
                <Link href="/abonnement">
                  <Button className="gap-1" data-testid="btn-manage-plan">
                    {isFree ? "Découvrir Pro" : "Gérer mon plan"} <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-1">Utilisation ce mois-ci</p>
                <p className="text-lg font-semibold" data-testid="text-usage">
                  {me.usage.contacts_used} / {me.usage.contacts_limit === -1 ? "∞" : me.usage.contacts_limit} contacts
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm ring-1 ring-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Mes factures
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !invoices || invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucune facture pour le moment</p>
            </div>
          ) : (
            <div className="divide-y">
              {invoices.map((inv) => (
                <div key={inv.id} className="py-3 flex items-center justify-between gap-3 flex-wrap" data-testid={`invoice-row-${inv.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold">{inv.reference}</span>
                      <Badge variant={inv.status === "payée" ? "default" : "outline"} className={inv.status === "payée" ? "bg-primary" : ""}>
                        {inv.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Plan {PLAN_LABELS[inv.plan_name] ?? inv.plan_name} ·{" "}
                      {new Date(inv.created_at).toLocaleDateString("fr-FR")}
                      {inv.payment_method && ` · ${PAYMENT_METHOD_LABELS[inv.payment_method] ?? inv.payment_method}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{FCFA(inv.amount_fcfa)} FCFA</p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => handleDownload(inv.id, inv.reference)} data-testid={`btn-download-invoice-${inv.id}`}>
                    <Download className="h-3 w-3" /> PDF
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
