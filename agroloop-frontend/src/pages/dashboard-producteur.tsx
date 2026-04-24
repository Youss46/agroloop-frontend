import { Link } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { useGetDashboardProducteur, useGetMesOffres } from "@/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Package, CircleDollarSign, TrendingUp, AlertCircle, FileText } from "lucide-react";
import { PendingRatings } from "@/components/pending-ratings";
import { PendingSignatures } from "@/components/pending-signatures";
import { StarRating } from "@/components/star-rating";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { PendingActionsWidget } from "@/components/pending-actions-widget";
import { VerificationBanner } from "@/components/verification-banner";
import { WelcomeModal } from "@/components/welcome-modal";

export default function DashboardProducteur() {
  const { user } = useAuth();
  const { data: stats, isLoading: isStatsLoading } = useGetDashboardProducteur();
  const { data: offres, isLoading: isOffresLoading } = useGetMesOffres();

  const formatNumber = (num?: number) => {
    if (num === undefined) return "0";
    return new Intl.NumberFormat("fr-CI").format(num);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "disponible":
        return <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-none">Disponible</Badge>;
      case "vendu":
        return <Badge variant="outline" className="bg-muted text-muted-foreground border-none">Vendu</Badge>;
      case "expiré":
        return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-none hover:bg-destructive/20">Expiré</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 max-w-6xl">
      <WelcomeModal />
      <VerificationBanner />
      <OnboardingChecklist />
      <PendingActionsWidget />
      <PendingSignatures />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tableau de bord Producteur</h1>
          <p className="text-muted-foreground mt-1">Bienvenue, {user?.name}. Voici un résumé de votre activité.</p>
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
          <Link href="/offres/nouvelle">
            <Button className="gap-2 w-full md:w-auto" data-testid="button-dashboard-new-offer">
              <PlusCircle className="h-4 w-4" />
              Nouvelle offre
            </Button>
          </Link>
        </div>
      </div>

      <PendingRatings />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="bg-card shadow-sm border-none ring-1 ring-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Offert (kg)</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isStatsLoading ? <Skeleton className="h-8 w-20" /> : formatNumber(stats?.totalKgOffert)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card shadow-sm border-none ring-1 ring-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenus (FCFA)</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isStatsLoading ? <Skeleton className="h-8 w-24" /> : formatNumber(stats?.totalFcfaGagne)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card shadow-sm border-none ring-1 ring-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offres Actives</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {isStatsLoading ? <Skeleton className="h-8 w-12" /> : stats?.offresActives || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card shadow-sm border-none ring-1 ring-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offres Vendues</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isStatsLoading ? <Skeleton className="h-8 w-12" /> : stats?.offresVendues || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Mes Offres Récentes</h2>
        
        {isOffresLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : offres && offres.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {offres.map((offre) => (
              <Card key={offre.id} className="overflow-hidden border-none shadow-sm ring-1 ring-border/50 flex flex-col" data-testid={`card-my-offer-${offre.id}`}>
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="font-semibold text-lg text-foreground leading-tight line-clamp-1">{offre.typeResidu}</div>
                    {getStatusBadge(offre.status)}
                  </div>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Quantité:</span>
                      <span className="font-medium text-foreground">{formatNumber(offre.quantityKg)} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prix:</span>
                      <span className="font-medium text-foreground">{formatNumber(offre.priceFcfa)} FCFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date:</span>
                      <span>{new Date(offre.createdAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground">Aucune offre publiée</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                Vous n'avez pas encore publié d'offres de résidus. Cliquez sur "Nouvelle offre" pour commencer.
              </p>
              <Link href="/offres/nouvelle">
                <Button className="mt-6" variant="outline">Créer ma première offre</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
