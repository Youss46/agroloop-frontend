import { useParams, useLocation, Link } from "wouter";
import { useEffect, useState, useCallback } from "react";
import { customFetch, useCreateConversation } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Calendar, Package, Phone, MessageSquare, ChevronLeft, ChevronRight, X, User as UserIcon, Truck, FileText } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { DevisModal } from "@/components/devis-modal";
import { devisApi } from "@/lib/devis-api";
import { useToast } from "@/hooks/use-toast";
import { StarRating } from "@/components/star-rating";
import { VerificationBadge } from "@/components/verification-badge";
import { ReportOfferButton } from "@/components/report-offer-button";
import { FavoriteHeart } from "@/components/favorite-heart";
import { ShareButton } from "@/components/share-modal";
import { OnlineStatus } from "@/components/online-status";

const formatNumber = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

interface PhotoDto {
  id: number;
  file_url: string;
  thumbnail_url: string;
  is_cover: boolean;
  position: number;
}

export default function OffreDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const createConv = useCreateConversation();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [devisOpen, setDevisOpen] = useState(false);

  const { data: offre, isLoading, error } = useQuery({
    queryKey: ["offre-detail", id],
    queryFn: () => customFetch<any>(`/api/offres/${id}`),
    enabled: !!id,
  });

  const { data: activeDevis } = useQuery({
    queryKey: ["devis", "active-for-offre", Number(id)],
    queryFn: () => devisApi.activeForOffre(Number(id)),
    enabled: !!id && user?.role === "transformateur",
  });

  const photos: PhotoDto[] = offre?.photos ?? [];

  const closeLightbox = useCallback(() => setLightboxIdx(null), []);
  const next = useCallback(() => setLightboxIdx((i) => (i == null ? null : (i + 1) % photos.length)), [photos.length]);
  const prev = useCallback(() => setLightboxIdx((i) => (i == null ? null : (i - 1 + photos.length) % photos.length)), [photos.length]);

  useEffect(() => {
    if (lightboxIdx == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, closeLightbox, next, prev]);

  const handleMessage = () => {
    if (!user) { setLocation("/login"); return; }
    createConv.mutate({ data: { offreId: Number(id) } }, {
      onSuccess: (conv: any) => setLocation(`/messages#${conv.id}`),
      onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e?.data?.error || "Impossible d'ouvrir la conversation" }),
    });
  };

  const handleWhatsApp = () => {
    if (!offre?.sellerPhone) return;
    const msg = encodeURIComponent(`Bonjour, je suis intéressé(e) par votre offre de ${offre.typeResidu} (${offre.quantityKg} kg, ${offre.priceFcfa} FCFA) sur AgroLoopCI.`);
    const phone = offre.sellerPhone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-[400px] w-full mb-6" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !offre) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-5xl text-center">
        <p className="text-muted-foreground mb-4">Offre introuvable</p>
        <Button onClick={() => setLocation("/marketplace")}>Retour à la marketplace</Button>
      </div>
    );
  }

  const cover = photos.find((p) => p.is_cover) ?? photos[0];

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <Button variant="ghost" size="sm" onClick={() => setLocation("/marketplace")} className="mb-4 gap-2" data-testid="button-back-marketplace">
        <ArrowLeft className="h-4 w-4" /> Retour à la marketplace
      </Button>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Gallery */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => cover && setLightboxIdx(photos.indexOf(cover))}
            className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-muted block"
            data-testid="button-cover-photo"
          >
            {cover ? (
              <img src={cover.file_url} alt={offre.typeResidu} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">Pas de photo</div>
            )}
          </button>

          {photos.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLightboxIdx(i)}
                  className="relative aspect-square rounded-md overflow-hidden bg-muted hover:ring-2 hover:ring-primary"
                  data-testid={`button-thumb-${i}`}
                >
                  <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <h1 className="text-2xl font-bold leading-tight" data-testid="text-offre-type">{offre.typeResidu}</h1>
              <Badge variant={offre.status === "disponible" ? "default" : "secondary"}>{offre.status}</Badge>
            </div>
            <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
              <span className="flex items-center"><MapPin className="h-3.5 w-3.5 mr-1" />{offre.region}</span>
              {offre.disponibilite && (
                <Badge variant="outline" className="text-xs">{offre.disponibilite === "immediate" ? "Immédiate" : "Planifiée"}</Badge>
              )}
              {(offre as any).livraisonPossible && (
                <Badge variant="outline" className="text-xs gap-1 border-primary/40 text-primary" data-testid="badge-livraison-detail">
                  <Truck className="h-3 w-3" /> Livraison possible
                </Badge>
              )}
            </div>
          </div>

          <Card className="border-none shadow-sm ring-1 ring-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Quantité</span>
                <span className="font-bold">{formatNumber(offre.quantityKg)} kg</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Prix total</span>
                <span className="font-bold text-lg text-primary">{formatNumber(offre.priceFcfa)} FCFA</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground flex items-center"><Calendar className="h-3.5 w-3.5 mr-1" />Publié le</span>
                <span>{new Date(offre.createdAt).toLocaleDateString("fr-FR")}</span>
              </div>
            </CardContent>
          </Card>

          {offre.description && (
            <Card className="border-none shadow-sm ring-1 ring-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-base">Description</CardTitle></CardHeader>
              <CardContent className="pt-0"><p className="text-sm whitespace-pre-line">{offre.description}</p></CardContent>
            </Card>
          )}

          <Card className="border-none shadow-sm ring-1 ring-border/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{offre.sellerName}</span>
                <VerificationBadge level={offre.sellerVerificationLevel ?? 0} size="sm" />
              </div>
              <OnlineStatus
                userId={offre.sellerId}
                lastSeen={offre.sellerLastSeen ?? null}
                showOnlineStatus={offre.sellerShowOnlineStatus ?? null}
              />
              <StarRating value={offre.sellerRatingAvg ?? 0} count={offre.sellerRatingCount ?? 0} profileLinkUserId={offre.sellerId} />
              <Link href={`/profil/${offre.sellerId}`} className="inline-flex items-center text-xs text-primary hover:underline">
                <UserIcon className="h-3 w-3 mr-1" /> Voir le profil
              </Link>
            </CardContent>
          </Card>

          {/* Favorite + Share row */}
          <div className="flex flex-wrap gap-2">
            <FavoriteHeart type="offre" id={offre.id} variant="full" />
            <ShareButton
              offre={{
                id: offre.id,
                type_residu: offre.typeResidu,
                quantity_kg: offre.quantityKg,
                price_fcfa: offre.priceFcfa,
                region: offre.region,
                coverPhoto: cover?.thumbnail_url ?? cover?.file_url ?? null,
              }}
              variant="full"
            />
          </div>

          {/* Public CTA banner — show when viewer is unauthenticated */}
          {!user && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 text-center space-y-3">
                <p className="text-sm font-medium">
                  🌱 Connectez-vous pour contacter ce producteur et accéder à toutes les fonctionnalités d'AgroLoopCI.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => setLocation("/login")} className="bg-primary" data-testid="button-cta-login">
                    Se connecter
                  </Button>
                  <Button onClick={() => setLocation("/register")} variant="outline" data-testid="button-cta-register">
                    Créer un compte
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {user?.role !== "producteur" && (
            <div className="flex flex-col gap-2">
              {user?.role === "transformateur" && (
                activeDevis?.active_devis ? (
                  <Link href={`/devis/${activeDevis.active_devis.id}`}>
                    <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700" data-testid="button-detail-view-devis">
                      <FileText className="h-4 w-4" /> Voir ma demande de devis en cours
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={() => setDevisOpen(true)}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    disabled={offre.status !== "disponible"}
                    data-testid="button-detail-devis"
                  >
                    <FileText className="h-4 w-4" /> Faire une offre de prix
                  </Button>
                )
              )}
              <Button onClick={handleMessage} disabled={createConv.isPending} variant="outline" className="gap-2" data-testid="button-detail-message">
                <MessageSquare className="h-4 w-4" /> Envoyer un message
              </Button>
              <Button variant="outline" onClick={handleWhatsApp} disabled={!offre.sellerPhone} className="gap-2 border-[#25D366] text-[#128C7E] hover:bg-[#25D366]/10" data-testid="button-detail-whatsapp">
                <Phone className="h-4 w-4" /> {offre.sellerPhone ? "WhatsApp" : "Numéro indisponible"}
              </Button>
              {user && user.id !== offre.sellerId && (
                <ReportOfferButton offreId={offre.id} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIdx != null && photos[lightboxIdx] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
          data-testid="lightbox"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full"
            aria-label="Fermer"
            data-testid="button-close-lightbox"
          >
            <X className="h-6 w-6" />
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded-full"
                aria-label="Précédente"
                data-testid="button-lightbox-prev"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded-full"
                aria-label="Suivante"
                data-testid="button-lightbox-next"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            </>
          )}
          <img
            src={photos[lightboxIdx].file_url}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
            {lightboxIdx + 1} / {photos.length}
          </div>
        </div>
      )}
    </div>
  );
}
