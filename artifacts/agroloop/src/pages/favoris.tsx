import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Heart, MapPin, Package, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { favoritesApi, type FavoriteOffre, type FavoriteProducteur } from "@/lib/favorites-api";
import { FavoriteHeart } from "@/components/favorite-heart";
import { useAuth } from "@/components/auth-provider";
import { OnlineStatus } from "@/components/online-status";
import { VerificationBadge } from "@/components/verification-badge";
import { StarRating } from "@/components/star-rating";

const formatNumber = (n: number) => new Intl.NumberFormat("fr-CI").format(Math.round(n));

export default function Favoris() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => favoritesApi.list(),
    enabled: !!user,
  });

  if (!user || user.role !== "transformateur") {
    return (
      <div className="container mx-auto py-12 px-4 max-w-3xl text-center">
        <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Mes Favoris</h1>
        <p className="text-muted-foreground">
          Cette fonctionnalité est réservée aux transformateurs.
        </p>
      </div>
    );
  }

  const offres = data?.offres ?? [];
  const producteurs = data?.producteurs ?? [];

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="flex items-center gap-2 mb-6">
        <Heart className="h-6 w-6 text-[#ef4444] fill-[#ef4444]" />
        <h1 className="text-2xl font-bold">Mes Favoris</h1>
      </div>

      <Tabs defaultValue="offres" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="offres" data-testid="tab-favoris-offres">
            Offres ({offres.length})
          </TabsTrigger>
          <TabsTrigger value="producteurs" data-testid="tab-favoris-producteurs">
            Producteurs ({producteurs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="offres" className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full" />)}
            </div>
          ) : offres.length === 0 ? (
            <EmptyState
              icon="❤️"
              title="Aucune offre favorite"
              description="Cliquez sur le cœur sur une offre pour la sauvegarder ici et la retrouver facilement."
              cta={<Link href="/marketplace"><Button>Parcourir le marché</Button></Link>}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {offres.map((o: FavoriteOffre) => <OffreCard key={o.favId} o={o} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="producteurs" className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : producteurs.length === 0 ? (
            <EmptyState
              icon="👨‍🌾"
              title="Aucun producteur suivi"
              description="Suivez vos producteurs préférés pour être notifié de leurs nouvelles offres."
              cta={<Link href="/marketplace"><Button>Découvrir des producteurs</Button></Link>}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {producteurs.map((p: FavoriteProducteur) => <ProducteurCard key={p.favId} p={p} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ icon, title, description, cta }: { icon: string; title: string; description: string; cta: React.ReactNode }) {
  return (
    <div className="text-center py-16 border-2 border-dashed rounded-lg" data-testid="empty-favoris">
      <div className="text-5xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">{description}</p>
      {cta}
    </div>
  );
}

function OffreCard({ o }: { o: FavoriteOffre }) {
  const statusColor = o.status === "disponible" ? "bg-green-100 text-green-700" : o.status === "vendu" ? "bg-gray-100 text-gray-700" : "bg-orange-100 text-orange-700";
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow flex flex-col" data-testid={`card-fav-offre-${o.id}`}>
      <div className="relative">
        <Link href={`/offre/${o.id}`}>
          <div className="h-36 bg-muted overflow-hidden">
            {o.coverPhoto ? (
              <img src={o.coverPhoto} alt={o.type_residu} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Package className="h-8 w-8 opacity-30" /></div>
            )}
          </div>
        </Link>
        <div className="absolute top-2 right-2">
          <FavoriteHeart type="offre" id={o.id} initialFavorited />
        </div>
        {o.status !== "disponible" && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Badge className={statusColor}>{o.status === "vendu" ? "Vendu" : "Expiré"}</Badge>
          </div>
        )}
      </div>
      <CardContent className="p-4 flex-1 flex flex-col gap-2">
        <Link href={`/offre/${o.id}`} className="hover:text-primary">
          <h3 className="font-semibold leading-tight">{o.type_residu}</h3>
        </Link>
        <div className="flex justify-between text-sm">
          <span>{formatNumber(o.quantity_kg)} kg</span>
          <span className="font-bold text-primary">{formatNumber(o.price_fcfa)} FCFA</span>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {o.region}</div>
        {o.sellerId && (
          <div className="text-xs text-muted-foreground mt-auto pt-2 border-t flex items-center justify-between">
            <span>Par {o.sellerName}</span>
            <OnlineStatus userId={o.sellerId} lastSeen={o.sellerLastSeen} showOnlineStatus={o.sellerShowOnline} showLabel={false} size="sm" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProducteurCard({ p }: { p: FavoriteProducteur }) {
  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`card-fav-producteur-${p.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Link href={`/profil/${p.id}`} className="flex-shrink-0">
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt={p.name} className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-lg font-semibold">
                {p.name.charAt(0).toUpperCase()}
              </div>
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/profil/${p.id}`} className="hover:text-primary">
                <div className="font-semibold flex items-center gap-1">
                  {p.name}
                  <VerificationBadge level={p.verificationLevel ?? 0} size="sm" />
                </div>
              </Link>
              <FavoriteHeart type="producteur" id={p.id} initialFavorited />
            </div>
            <OnlineStatus userId={p.id} lastSeen={p.lastSeen} showOnlineStatus={p.showOnlineStatus} size="sm" />
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {p.region && <><MapPin className="h-3 w-3" /> {p.region}</>}
            </div>
            {p.filieres?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {p.filieres.slice(0, 3).map(f => <Badge key={f} variant="outline" className="text-xs">{f}</Badge>)}
              </div>
            )}
            <div className="flex items-center justify-between text-xs mt-2">
              <StarRating value={p.ratingAvg ?? 0} count={p.ratingCount ?? 0} />
              <Badge variant="secondary">{p.activeOffres} offre{p.activeOffres > 1 ? "s" : ""} active{p.activeOffres > 1 ? "s" : ""}</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
