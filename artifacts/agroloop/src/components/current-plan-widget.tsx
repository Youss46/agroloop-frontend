import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Zap, Sparkles, ArrowRight } from "lucide-react";
import { subscriptionsApi, PLAN_LABELS } from "@/lib/subscriptions-api";

export function CurrentPlanWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["subscription-me"],
    queryFn: () => subscriptionsApi.me(),
  });

  if (isLoading || !data) {
    return (
      <Card className="border-none shadow-sm ring-1 ring-border/50 mb-6">
        <CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent>
      </Card>
    );
  }

  const { plan, subscription, usage } = data;
  const isFree = plan.name === "gratuit";
  const isPro = plan.name === "pro";
  const isBusiness = plan.name === "business";

  const Icon = isBusiness ? Crown : isPro ? Sparkles : Zap;
  const ringColor = isBusiness ? "ring-amber-300" : isPro ? "ring-primary/30" : "ring-border/50";
  const iconBg = isBusiness ? "bg-amber-100 text-amber-700" : isPro ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";

  const limit = usage.contacts_limit;
  const used = usage.contacts_used;
  const pct = limit === -1 ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const expiresAt = subscription ? new Date(subscription.expires_at) : null;

  return (
    <Card className={`border-none shadow-sm ring-1 ${ringColor} mb-6`} data-testid="current-plan-widget">
      <CardHeader className="pb-3 flex flex-row items-center gap-3 space-y-0">
        <div className={`p-2 rounded-lg ${iconBg}`}><Icon className="h-5 w-5" /></div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base flex items-center gap-2">
            Plan {PLAN_LABELS[plan.name]}
            {!isFree && <Badge className={isBusiness ? "bg-amber-500" : "bg-primary"}>Actif</Badge>}
            {subscription?.status === "cancelled" && (
              <Badge variant="outline" className="border-amber-300 text-amber-700">Annulé</Badge>
            )}
          </CardTitle>
          {expiresAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {subscription?.status === "cancelled" ? "Accès jusqu'au " : "Renouvellement le "}
              {expiresAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </div>
        {isFree && (
          <Link href="/abonnement">
            <Button size="sm" className="gap-1" data-testid="btn-upgrade-from-widget">
              Passer Pro <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Contacts ce mois-ci</span>
            <span className="font-semibold" data-testid="usage-counter">
              {used} / {limit === -1 ? "∞" : limit}
            </span>
          </div>
          {limit !== -1 && (
            <>
              <Progress value={pct} className="h-2" />
              {used >= limit && (
                <p className="text-xs text-destructive font-medium">
                  Limite atteinte. Passez Pro pour des contacts illimités.
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
