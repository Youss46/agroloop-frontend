import { Link } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { useGetDashboardTransformateur } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, CircleDollarSign, TrendingUp, Search, MapPin, Calendar, FileText } from "lucide-react";
import { PendingRatings } from "@/components/pending-ratings";
import { PendingSignatures } from "@/components/pending-signatures";
import { StarRating } from "@/components/star-rating";
import { CurrentPlanWidget } from "@/components/current-plan-widget";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { PendingActionsWidget } from "@/components/pending-actions-widget";
import { VerificationBanner } from "@/components/verification-banner";
import { WelcomeModal } from "@/components/welcome-modal";

export default function DashboardTransformateur() {
  const { user } = useAuth();
  const { data: stats, isLoading: isStatsLoading } = useGetDashboardTransformateur();

  const formatNumber = (num?: number) => {
    if (num === undefined) return "0";
    return new Intl.NumberFormat("fr-CI").format(num);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "en_attente":
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-none">En attente</Badge>;
      case "confirmée":
        return <Badge className="bg-primary/20 text-primary border-none">Confirmée</Badge>;
      case "annulée":
        return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-none">Annulée</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 max-w-6xl">
      <WelcomeModal />
      <VerificationBanner />
      <OnboardingChecklist />
      <CurrentPlanWidget />
      <PendingActionsWidget />
      <PendingSignatures />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tableau de bord Transformateur</h1>
          <p className="text-muted-foreground mt-1">Bienvenue, {user?.name}. Voici un résumé de vos achats.</p>
          {user && (
            <div className="mt-2">
              <StarRating
                value={user.ratingAvg ?? 0}
                count={user.ratingCount ?? 0}
                profileLinkUserId={user.id}
                size={16}
                emptyLabel="Aucun avis pour le moment"
              />
            </div>
          )}
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <Link href="/marketplace">
            <Button className="gap-2 w-full md:w-auto" data-testid="button-dashboard-find-offers">
              <Search className="h-4 w-4" />
              Trouver des résidus
            </Button>
          </Link>
        </div>
      </div>

      <PendingRatings />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="bg-card shadow-sm border-none ring-1 ring-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Acheté (kg)</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isStatsLoading ? <Skeleton className="h-8 w-20" /> : formatNumber(stats?.totalKgAchete)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card shadow-sm border-none ring-1 ring-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dépenses (FCFA)</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isStatsLoading ? <Skeleton className="h-8 w-24" /> : formatNumber(stats?.totalFcfaDepense)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card shadow-sm border-none ring-1 ring-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Cours</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {isStatsLoading ? <Skeleton className="h-8 w-12" /> : stats?.transactionsEnCours || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card shadow-sm border-none ring-1 ring-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmées</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {isStatsLoading ? <Skeleton className="h-8 w-12" /> : stats?.transactionsConfirmees || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Transactions Récentes</h2>
        
        {isStatsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stats.recentTransactions.map((tx) => (
              <Card key={tx.id} className="overflow-hidden border-none shadow-sm ring-1 ring-border/50 flex flex-col" data-testid={`card-my-tx-${tx.id}`}>
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="font-semibold text-lg text-foreground leading-tight line-clamp-1">{tx.typeResidu}</div>
                    {getStatusBadge(tx.status)}
                  </div>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center">
                       <MapPin className="h-3.5 w-3.5 mr-2" />
                       <span className="font-medium text-foreground">{tx.region}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Quantité:</span>
                      <span className="font-medium text-foreground">{formatNumber(tx.quantityKg)} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total payé:</span>
                      <span className="font-medium text-foreground">{formatNumber(tx.totalFcfa)} FCFA</span>
                    </div>
                    <div className="flex items-center">
                       <Calendar className="h-3.5 w-3.5 mr-2" />
                       <span>{new Date(tx.createdAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground">Aucune transaction</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                Vous n'avez pas encore acheté de résidus. Parcourez la marketplace pour trouver ce dont vous avez besoin.
              </p>
              <Link href="/marketplace">
                <Button className="mt-6" variant="outline">Explorer la marketplace</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
