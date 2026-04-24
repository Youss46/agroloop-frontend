import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { markSearchPerformed } from "@/components/onboarding-checklist";
import { useAuth } from "@/components/auth-provider";
import { useListOffres, useCreateConversation } from "@workspace/api-client-react";
import { dashboardApi, type BuyerStatesMap } from "@/lib/buyer-state-api";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MapPin, Search, Phone, Calendar, Package, MessageSquare, User as UserIcon, SlidersHorizontal, Navigation, Camera, Truck, FileText, ShoppingCart } from "lucide-react";
import { DevisModal } from "@/components/devis-modal";
import { AddToCartModal } from "@/components/add-to-cart-modal";
import { useToast } from "@/hooks/use-toast";
import { StarRating } from "@/components/star-rating";
import { VerificationBadge } from "@/components/verification-badge";
import { MarketplaceFilters, FilterChips, DEFAULT_FILTERS, activeFilterCount, type MarketplaceFiltersState } from "@/components/marketplace-filters";
import { FavoriteHeart } from "@/components/favorite-heart";
import { ShareButton } from "@/components/share-modal";
import { OnlineDot } from "@/components/online-status";
import { isOnlineFromLastSeen } from "@/lib/online-status";
import { marcheApi, type PrixActuel } from "@/lib/marche-api";
import { TrendingDown, TrendingUp } from "lucide-react";

export default function Marketplace() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createConv = useCreateConversation();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<MarketplaceFiltersState>(DEFAULT_FILTERS);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [devisFor, setDevisFor] = useState<null | { id: number; type_residu: string; quantity_kg: number; price_fcfa: number; seller_name: string }>(null);
  const [cartFor, setCartFor] = useState<null | { id: number; type_residu: string; quantity_kg: number; price_fcfa: number; seller_name: string }>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (activeFilterCount(filters) > 0) markSearchPerformed(user.id);
  }, [user?.id, filters]);

  const submitSearch = () => {
    if (user?.id && search.trim().length > 0) markSearchPerformed(user.id);
  };

  const queryParams: any = { status: "disponible" };
  if (search) queryParams.search = search;
  if (filters.region !== "all") queryParams.region = filters.region;
  if (filters.typeResidu !== "all") queryParams.type_residu = filters.typeResidu;
  if (filters.prixMin != null) queryParams.prix_min = filters.prixMin;
  if (filters.prixMax != null) queryParams.prix_max = filters.prixMax;
  if (filters.disponibilite) queryParams.disponibilite = filters.disponibilite;
  if (filters.livraisonPossible) queryParams.livraison_possible = true;
  if (filters.sortBy) queryParams.sort_by = filters.sortBy;
  if (filters.lat != null && filters.lng != null) {
    queryParams.lat = filters.lat;
    queryParams.lng = filters.lng;
    if (filters.radiusKm != null) queryParams.radius_km = filters.radiusKm;
  }

  const { data: offres, isLoading } = useListOffres(queryParams);
  const { data: prixActuels } = useQuery({
    queryKey: ["marche", "prix-actuels"],
    queryFn: () => marcheApi.prixActuels(),
    staleTime: 10 * 60_000,
  });
  const prixMap: Record<string, PrixActuel> = (prixActuels?.prixActuels ?? []).reduce(
    (acc, p) => { acc[p.typeResidu] = p; return acc; },
    {} as Record<string, PrixActuel>,
  );
  const { data: buyerStates } = useQuery<BuyerStatesMap>({
    queryKey: ["buyer-states"],
    queryFn: () => dashboardApi.getBuyerStates(),
    enabled: user?.role === "transformateur",
    refetchInterval: 30000,
  });

  const formatNumber = (num?: number) => (num === undefined ? "0" : new Intl.NumberFormat("fr-CI").format(num));

  const handleWhatsApp = (phone: string | null | undefined, type: string, qty: number, price: number) => {
    if (!phone) return;
    const msg = `Bonjour, je suis intéressé par votre offre de ${qty} kg de ${type} à ${price} FCFA sur AgroLoopCI.`;
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleMessage = async (offerId: number) => {
    if (!user) { setLocation("/login"); return; }
    if (user.role !== "transformateur") {
      toast({ title: "Action non autorisée", description: "Seuls les transformateurs peuvent contacter les vendeurs.", variant: "destructive" });
      return;
    }
    try {
      const conv = await createConv.mutateAsync({ data: { offerId } });
      setLocation(`/messages#${conv.id}`);
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message ?? "Impossible de démarrer la conversation", variant: "destructive" });
    }
  };

  const filterCount = activeFilterCount(filters);

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace — Résidus agricoles</h1>
          <p className="text-muted-foreground mt-1">Trouvez la matière première agricole dont vous avez besoin.</p>
        </div>
        <Link href="/carte">
          <Button variant="outline" className="gap-2 w-full md:w-auto" data-testid="button-marketplace-map">
            <MapPin className="h-4 w-4" /> Vue sur la carte
          </Button>
        </Link>
      </div>

      <div className="bg-card shadow-sm ring-1 ring-border/50 rounded-xl p-3 mb-6 flex gap-2 items-center">
        <form
          className="relative flex-1"
          onSubmit={(e) => { e.preventDefault(); submitSearch(); }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un résidu agricole..."
            className="pl-9 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); }}
            data-testid="input-marketplace-search"
          />
        </form>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="md:hidden relative gap-2" data-testid="button-open-filters">
              <SlidersHorizontal className="h-4 w-4" />
              Filtres
              {filterCount > 0 && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filtres</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <MarketplaceFilters value={filters} onChange={setFilters} />
              <Button className="w-full mt-4" onClick={() => setMobileOpen(false)}>
                Appliquer
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex gap-6">
        <aside className="hidden md:block w-[280px] shrink-0">
          <div className="bg-card shadow-sm ring-1 ring-border/50 rounded-xl p-4 sticky top-20">
            <MarketplaceFilters value={filters} onChange={setFilters} />
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <FilterChips value={filters} onChange={setFilters} />

          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="overflow-hidden border-none shadow-sm ring-1 ring-border/50">
                  <CardHeader className="pb-4">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent className="space-y-4 pb-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                  <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
                </Card>
              ))}
            </div>
          ) : Array.isArray(offres) && offres.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {offres.map((offre: any) => (
                <Card key={offre.id} className="overflow-hidden border-none shadow-sm ring-1 ring-border/50 hover:shadow-md transition-shadow flex flex-col" data-testid={`card-marketplace-offer-${offre.id}`}>
                  <div className="relative">
                    <Link href={`/offre/${offre.id}`} className="block relative h-[180px] bg-muted overflow-hidden group" data-testid={`link-offre-cover-${offre.id}`}>
                      {offre.cover_photo_url ? (
                        <img src={offre.cover_photo_url} alt={offre.typeResidu} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Package className="h-10 w-10 opacity-30" />
                        </div>
                      )}
                      {offre.photo_count > 0 && (
                        <span className="absolute bottom-2 right-2 bg-black/65 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1" data-testid={`badge-photo-count-${offre.id}`}>
                          <Camera className="h-3 w-3" /> {offre.photo_count}
                        </span>
                      )}
                    </Link>
                    <div className="absolute top-2 right-2 flex gap-1.5 z-10">
                      <FavoriteHeart type="offre" id={offre.id} testId={`button-favorite-card-${offre.id}`} />
                      <ShareButton offre={{
                        id: offre.id, type_residu: offre.typeResidu, quantity_kg: offre.quantityKg,
                        price_fcfa: offre.priceFcfa, region: offre.region,
                        coverPhoto: offre.cover_photo_url ?? null,
                      }} />
                    </div>
                  </div>
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start gap-4">
                      <CardTitle className="text-xl font-bold leading-tight">{offre.typeResidu}</CardTitle>
                      <Badge className="bg-primary/10 text-primary border-none hover:bg-primary/20 whitespace-nowrap">
                        {formatNumber(offre.quantityKg)} kg
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-2">
                      <span className="flex items-center"><MapPin className="h-3.5 w-3.5 mr-1" />{offre.region}</span>
                      {offre.distanceKm != null && (
                        <Badge variant="outline" className="gap-1 text-xs" data-testid={`badge-distance-${offre.id}`}>
                          <Navigation className="h-3 w-3" /> {offre.distanceKm.toFixed(1)} km
                        </Badge>
                      )}
                      {offre.disponibilite && (
                        <Badge variant={offre.disponibilite === "immediate" ? "default" : "secondary"} className="text-xs" data-testid={`badge-disponibilite-${offre.id}`}>
                          {offre.disponibilite === "immediate" ? "Immédiate" : "Planifiée"}
                        </Badge>
                      )}
                      {(offre as any).livraisonPossible && (
                        <Badge variant="outline" className="gap-1 text-xs border-primary/40 text-primary" data-testid={`badge-livraison-${offre.id}`}>
                          <Truck className="h-3 w-3" /> Livraison possible
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pb-4 flex-1">
                    <div className="bg-muted/30 rounded-lg p-3 flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Prix total</span>
                      <span className="font-bold text-lg text-primary">{formatNumber(offre.priceFcfa)} FCFA</span>
                    </div>
                    {(() => {
                      const marketRef = prixMap[offre.typeResidu];
                      if (!marketRef || !offre.quantityKg || offre.quantityKg <= 0) return null;
                      const unit = offre.priceFcfa / offre.quantityKg;
                      const diffPct = ((unit - marketRef.prixMoyen) / marketRef.prixMoyen) * 100;
                      if (Math.abs(diffPct) < 5) return null;
                      const cheaper = diffPct < 0;
                      return (
                        <Badge
                          variant="outline"
                          className={`gap-1 text-xs ${cheaper ? "border-green-500 text-green-700 bg-green-50" : "border-orange-400 text-orange-700 bg-orange-50"}`}
                          data-testid={`badge-market-comparison-${offre.id}`}
                        >
                          {cheaper ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                          {cheaper ? `${Math.abs(diffPct).toFixed(0)}% sous le marché` : `${diffPct.toFixed(0)}% au-dessus du marché`}
                        </Badge>
                      );
                    })()}

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <Package className="h-4 w-4 mr-2" />
                        Vendeur: <span className="font-medium text-foreground ml-1">{offre.sellerName}</span>
                        <span className="ml-2"><VerificationBadge level={(offre as any).sellerVerificationLevel ?? 0} size="sm" /></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StarRating value={offre.sellerRatingAvg ?? 0} count={offre.sellerRatingCount ?? 0} profileLinkUserId={offre.sellerId} />
                      </div>
                      <Link href={`/profil/${offre.sellerId}`} className="inline-flex items-center text-xs text-primary hover:underline" data-testid={`link-seller-profile-${offre.sellerId}`}>
                        <UserIcon className="h-3 w-3 mr-1" /> Voir le profil
                      </Link>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        Publié le: <span className="font-medium text-foreground ml-1">{new Date(offre.createdAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>

                    {offre.description && (
                      <p className="text-sm mt-3 line-clamp-2 text-muted-foreground bg-muted/20 p-2 rounded italic">"{offre.description}"</p>
                    )}
                  </CardContent>

                  <CardFooter className="pt-0 flex-col gap-2">
                    {user?.role === "transformateur" ? (() => {
                      const st = buyerStates?.[offre.id];
                      const inCart = !!st?.inCart;
                      const hasActiveOrder = !!st?.activeOrderId;
                      const hasActiveDevis = !!st?.activeDevisId;
                      return (
                        <>
                          {hasActiveOrder ? (
                            <Link href={`/commandes/${st!.activeOrderId}`} className="w-full">
                              <Button variant="outline" className="w-full gap-2 border-primary/50 text-primary" data-testid={`button-marketplace-in-order-${offre.id}`}>
                                <Package className="h-4 w-4" /> 📦 Commande en cours
                              </Button>
                            </Link>
                          ) : inCart ? (
                            <Link href="/panier" className="w-full">
                              <Button variant="outline" className="w-full gap-2 border-emerald-600 text-emerald-700" data-testid={`button-marketplace-in-cart-${offre.id}`}>
                                <ShoppingCart className="h-4 w-4" /> ✓ Dans le panier
                              </Button>
                            </Link>
                          ) : (
                            <Button
                              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => setCartFor({
                                id: offre.id, type_residu: offre.typeResidu, quantity_kg: offre.quantityKg,
                                price_fcfa: offre.priceFcfa, seller_name: offre.sellerName,
                              })}
                              data-testid={`button-marketplace-cart-${offre.id}`}
                            >
                              <ShoppingCart className="h-4 w-4" /> 🛒 Ajouter au panier
                            </Button>
                          )}

                          {hasActiveDevis ? (
                            <Link href={`/devis/${st!.activeDevisId}`} className="w-full">
                              <Button variant="outline" className="w-full gap-2 border-primary/50 text-primary" data-testid={`button-marketplace-devis-active-${offre.id}`}>
                                <FileText className="h-4 w-4" /> 📋 Devis en cours
                              </Button>
                            </Link>
                          ) : (
                            <Button
                              variant="outline"
                              className="w-full gap-2 border-emerald-600/50 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => setDevisFor({
                                id: offre.id, type_residu: offre.typeResidu, quantity_kg: offre.quantityKg,
                                price_fcfa: offre.priceFcfa, seller_name: offre.sellerName,
                              })}
                              data-testid={`button-marketplace-devis-${offre.id}`}
                            >
                              <FileText className="h-4 w-4" /> 📋 Faire une offre de prix
                            </Button>
                          )}

                          <Button variant="outline" className="w-full gap-2 text-muted-foreground" onClick={() => handleMessage(offre.id)} disabled={createConv.isPending} data-testid={`button-marketplace-contact-${offre.id}`}>
                            <MessageSquare className="h-4 w-4" /> 💬 Contacter
                          </Button>
                        </>
                      );
                    })() : user?.role !== "producteur" ? (
                      <>
                        <Button className="w-full gap-2" onClick={() => handleMessage(offre.id)} disabled={createConv.isPending} data-testid={`button-marketplace-message-${offre.id}`}>
                          <MessageSquare className="h-4 w-4" /> Messagerie
                        </Button>
                        <Button variant="outline" className="w-full gap-2 border-[#25D366] text-[#128C7E] hover:bg-[#25D366]/10" onClick={() => handleWhatsApp(offre.sellerPhone, offre.typeResidu, offre.quantityKg, offre.priceFcfa)} disabled={!offre.sellerPhone} data-testid={`button-marketplace-whatsapp-${offre.id}`}>
                          <Phone className="h-4 w-4" /> {offre.sellerPhone ? "WhatsApp" : "Numéro indisponible"}
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" className="w-full" disabled>Vous êtes producteur</Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed bg-muted/30">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground">Aucun résidu agricole disponible</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm">Essayez de modifier vos filtres ou revenez plus tard pour voir de nouvelles offres.</p>
                {(search || filterCount > 0) && (
                  <Button className="mt-6" variant="outline" onClick={() => { setSearch(""); setFilters(DEFAULT_FILTERS); }}>
                    Réinitialiser les filtres
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {devisFor && (
        <DevisModal
          open={!!devisFor}
          onOpenChange={(o) => { if (!o) setDevisFor(null); }}
          offre={devisFor}
        />
      )}
      {cartFor && (
        <AddToCartModal
          open={!!cartFor}
          onOpenChange={(o) => { if (!o) setCartFor(null); }}
          offre={cartFor}
        />
      )}
    </div>
  );
}
