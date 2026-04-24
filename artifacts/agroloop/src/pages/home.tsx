import { useGetStats } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Leaf, Recycle, Users, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import heroImage from "@assets/Screenshot_20260421-011356_1776734073256.png";

export default function Home() {
  const { data: stats, isLoading } = useGetStats();

  const formatNumber = (num?: number) => {
    if (num === undefined) return "0";
    return new Intl.NumberFormat("fr-CI").format(num);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-primary/5 py-24 lg:py-32">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=2070&auto=format&fit=crop')] opacity-5 bg-cover bg-center mix-blend-multiply" />
        <div className="container relative z-10 px-4 md:px-6">
          <div className="flex flex-col items-center text-center space-y-8 max-w-3xl mx-auto">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              🌿 Zéro gaspillage · Impact maximum
            </div>
            
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-foreground">
              Donnez de la valeur à vos <span className="text-primary">résidus agricoles</span>
            </h1>
            
            <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
              La première marketplace B2B dédiée à la valorisation des résidus agricoles en Côte d'Ivoire.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-8">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto gap-2 text-base h-12" data-testid="button-home-register-producteur">
                  <Leaf className="h-5 w-5" />
                  Je suis Producteur
                </Button>
              </Link>
              <Link href="/register">
                <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 text-base h-12 border-primary text-primary hover:bg-primary/5" data-testid="button-home-register-transformateur">
                  <Recycle className="h-5 w-5" />
                  Je suis Transformateur
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-background">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Notre Impact</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Ensemble, nous créons une chaîne de valeur plus durable et rentable pour l'agriculture ivoirienne.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="border-none shadow-md bg-card">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-primary/10 rounded-full text-primary">
                  <Recycle className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-4xl font-bold text-foreground">
                    {isLoading ? <Skeleton className="h-10 w-24 mx-auto" /> : `${formatNumber(stats?.totalKgValorise)} kg`}
                  </h3>
                  <p className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">Résidus agricoles valorisés</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-card">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-accent/10 rounded-full text-accent">
                  <Leaf className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-4xl font-bold text-foreground">
                    {isLoading ? <Skeleton className="h-10 w-24 mx-auto" /> : `${formatNumber(stats?.co2Evite)} kg`}
                  </h3>
                  <p className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">kg de CO₂ évités</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-card sm:col-span-2 lg:col-span-1">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-blue-500/10 rounded-full text-blue-500">
                  <Users className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-4xl font-bold text-foreground">
                    {isLoading ? <Skeleton className="h-10 w-24 mx-auto" /> : formatNumber(stats?.totalUtilisateurs)}
                  </h3>
                  <p className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">Producteurs connectés</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                  Comment ça marche ?
                </h2>
                <p className="text-lg text-muted-foreground">
                  AgroLoopCI simplifie la vente et l'achat de déchets agricoles à travers une plateforme sécurisée et intuitive.
                </p>
              </div>
              
              <ul className="space-y-6">
                <li className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Publiez vos résidus agricoles</h3>
                    <p className="mt-2 text-muted-foreground">Les producteurs publient leurs résidus disponibles. Les transformateurs recherchent la matière première dont ils ont besoin.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Connectez-vous avec des acheteurs</h3>
                    <p className="mt-2 text-muted-foreground">Utilisez notre intégration WhatsApp pour négocier les détails, les prix et la logistique directement avec le partenaire.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Valorisez et générez des revenus</h3>
                    <p className="mt-2 text-muted-foreground">Transformez des déchets en revenus additionnels ou en énergie verte, contribuant à une économie circulaire.</p>
                  </div>
                </li>
              </ul>
              
              <Link href="/marketplace">
                <Button variant="outline" className="gap-2 mt-4" data-testid="button-home-explore">
                  Explorer la Marketplace <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            
            <div className="relative mx-auto w-full max-w-[500px] aspect-square rounded-2xl overflow-hidden border bg-background shadow-xl">
              <img src={heroImage} alt="Cabosses de cacao sur l'arbre" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Cabosses de cacao</span>
                    <span className="text-xs font-medium text-muted-foreground">Bouaké</span>
                  </div>
                  <div className="font-bold text-lg">5 000 kg</div>
                  <div className="text-sm text-muted-foreground">75 000 FCFA</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
