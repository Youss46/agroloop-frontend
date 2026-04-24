import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useListOffres } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeft, MapPin, Phone, SlidersHorizontal, Navigation, Truck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { MarketplaceFilters, FilterChips, DEFAULT_FILTERS, activeFilterCount, type MarketplaceFiltersState } from "@/components/marketplace-filters";
import { VerificationBadge } from "@/components/verification-badge";
import { StarRating } from "@/components/star-rating";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const getMarkerIcon = (type: string) => {
  let color = "#16a34a";
  if (type.toLowerCase().includes("cacao")) color = "#8b5a2b";
  else if (type.toLowerCase().includes("anacarde")) color = "#f59e0b";
  else if (type.toLowerCase().includes("plantain")) color = "#84cc16";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white"/></svg>`;
  return L.divIcon({ className: "custom-leaflet-marker", html: svg, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -30] });
};

function MapAutoCenter({ center, radiusKm }: { center: [number, number] | null; radiusKm: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    const zoom = radiusKm ? (radiusKm <= 25 ? 10 : radiusKm <= 50 ? 9 : radiusKm <= 100 ? 8 : 7) : 9;
    map.setView(center, zoom);
  }, [center?.[0], center?.[1], radiusKm]);
  return null;
}

export default function Carte() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<MarketplaceFiltersState>(DEFAULT_FILTERS);
  const [mounted, setMounted] = useState(false);
  const [openFilters, setOpenFilters] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const queryParams: any = { status: "disponible" };
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

  const offresWithCoords = useMemo(
    () => (Array.isArray(offres) ? offres : []).filter((o: any) => o.latitude != null && o.longitude != null),
    [offres],
  );

  const formatNumber = (num?: number) => (num === undefined ? "0" : new Intl.NumberFormat("fr-CI").format(num));
  const handleWhatsApp = (phone: string | null | undefined, type: string, qty: number, price: number) => {
    if (!phone) return;
    const msg = `Bonjour, je suis intéressé par votre offre de ${qty} kg de ${type} à ${price} FCFA sur AgroLoopCI.`;
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (!mounted) return <div className="h-[calc(100vh-4rem)] w-full"><Skeleton className="h-full w-full" /></div>;

  const userCenter: [number, number] | null = filters.lat != null && filters.lng != null ? [filters.lat, filters.lng] : null;
  const filterCount = activeFilterCount(filters);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full relative">
      <aside className="hidden md:block w-[300px] shrink-0 border-r bg-card overflow-y-auto p-4">
        <div className="mb-4">
          <Link href="/marketplace">
            <Button variant="ghost" size="sm" className="gap-2 -ml-2" data-testid="button-map-back">
              <ArrowLeft className="h-4 w-4" /> Marketplace
            </Button>
          </Link>
        </div>
        <MarketplaceFilters value={filters} onChange={setFilters} />
        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
          <p data-testid="text-results-count">{offresWithCoords.length} offre(s) sur la carte</p>
        </div>
      </aside>

      <div className="flex-1 relative">
        <div className="md:hidden absolute top-4 left-4 z-[400] flex gap-2">
          <Link href="/marketplace">
            <Button variant="secondary" size="sm" className="shadow-md gap-2" data-testid="button-map-back-mobile">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Sheet open={openFilters} onOpenChange={setOpenFilters}>
            <SheetTrigger asChild>
              <Button variant="secondary" size="sm" className="shadow-md gap-2 relative" data-testid="button-open-filters-map">
                <SlidersHorizontal className="h-4 w-4" /> Filtres
                {filterCount > 0 && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
              <SheetHeader><SheetTitle>Filtres</SheetTitle></SheetHeader>
              <div className="mt-4">
                <MarketplaceFilters value={filters} onChange={setFilters} />
                <Button className="w-full mt-4" onClick={() => setOpenFilters(false)}>Appliquer</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="absolute top-4 right-4 z-[400] max-w-[60%]">
          <FilterChips value={filters} onChange={setFilters} />
        </div>

        {isLoading && (
          <div className="absolute inset-0 z-[500] bg-background/40 flex items-center justify-center backdrop-blur-sm">
            <Card className="p-4 flex items-center gap-3 shadow-lg">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
              <p className="text-sm font-medium">Chargement...</p>
            </Card>
          </div>
        )}

        <MapContainer center={[7.54, -5.55]} zoom={7} style={{ height: "100%", width: "100%" }} className="z-0">
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapAutoCenter center={userCenter} radiusKm={filters.radiusKm} />

          {userCenter && (
            <>
              <Marker position={userCenter} icon={L.divIcon({
                className: "user-location-marker",
                html: `<div style="background:#2563eb;border:3px solid white;border-radius:50%;width:18px;height:18px;box-shadow:0 0 0 4px rgba(37,99,235,0.3);"></div>`,
                iconSize: [18, 18], iconAnchor: [9, 9],
              })} />
              {filters.radiusKm && (
                <Circle center={userCenter} radius={filters.radiusKm * 1000} pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.08, weight: 2 }} />
              )}
            </>
          )}

          {offresWithCoords.map((offre: any) => (
            <Marker key={offre.id} position={[offre.latitude, offre.longitude]} icon={getMarkerIcon(offre.typeResidu)}>
              <Popup className="custom-popup">
                <div className="min-w-[220px] p-1">
                  <div className="flex gap-2 mb-2">
                    {offre.cover_photo_url ? (
                      <img src={offre.cover_photo_url} alt={offre.typeResidu} className="w-[80px] h-[80px] object-cover rounded shrink-0" />
                    ) : (
                      <div className="w-[80px] h-[80px] bg-muted rounded shrink-0 flex items-center justify-center text-muted-foreground text-xs">Pas de photo</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base leading-tight">{offre.typeResidu}</h3>
                      <div className="text-xs text-muted-foreground">{formatNumber(offre.quantityKg)} kg</div>
                      <div className="text-sm font-bold text-primary">{formatNumber(offre.priceFcfa)} FCFA</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mb-3 flex-wrap">
                    <span className="flex items-center"><MapPin className="h-3 w-3 mr-1" />{offre.region}</span>
                    {offre.distanceKm != null && (
                      <span className="flex items-center text-primary font-medium"><Navigation className="h-3 w-3 mr-1" />{offre.distanceKm.toFixed(1)} km</span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex justify-between"><span className="text-muted-foreground">Quantité:</span><span className="font-medium">{formatNumber(offre.quantityKg)} kg</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Prix:</span><span className="font-bold text-primary">{formatNumber(offre.priceFcfa)} FCFA</span></div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground">Vendeur:</span>
                      <span className="font-medium flex items-center gap-1 min-w-0">
                        <span className="truncate">{offre.sellerName}</span>
                        <VerificationBadge level={(offre as any).sellerVerificationLevel ?? 0} size="sm" />
                      </span>
                    </div>
                    {(offre.sellerRatingCount ?? 0) > 0 && (
                      <div className="flex justify-between items-center"><span className="text-muted-foreground">Note:</span>
                        <StarRating value={offre.sellerRatingAvg ?? 0} count={offre.sellerRatingCount ?? 0} profileLinkUserId={offre.sellerId} size={14} />
                      </div>
                    )}
                    {offre.disponibilite && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Disponibilité:</span><span className="font-medium">{offre.disponibilite === "immediate" ? "Immédiate" : "Planifiée"}</span></div>
                    )}
                    {(offre as any).livraisonPossible && (
                      <div className="flex justify-between items-center" data-testid={`popup-livraison-${offre.id}`}>
                        <span className="text-muted-foreground">Livraison:</span>
                        <span className="font-medium text-primary inline-flex items-center gap-1">
                          <Truck className="h-3 w-3" /> Possible
                        </span>
                      </div>
                    )}
                  </div>
                  {user?.role !== "producteur" ? (
                    <Button size="sm" className="w-full gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white h-8" onClick={() => handleWhatsApp(offre.sellerPhone, offre.typeResidu, offre.quantityKg, offre.priceFcfa)} disabled={!offre.sellerPhone}>
                      <Phone className="h-3 w-3" /> Contact
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full h-8" disabled>Vous êtes producteur</Button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
