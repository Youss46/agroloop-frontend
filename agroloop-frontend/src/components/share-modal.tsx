import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Share2, MessageCircle, Link as LinkIcon, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@/api-client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offre: {
    id: number;
    type_residu: string;
    quantity_kg: number;
    price_fcfa: number;
    region: string;
    coverPhoto?: string | null;
  };
};

function appBase(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.protocol}//${window.location.host}`;
}

export function ShareModal({ open, onOpenChange, offre }: Props) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const url = `${appBase()}/offre/${offre.id}`;
  const formatNumber = (n: number) => new Intl.NumberFormat("fr-CI").format(n);
  const message = `Bonjour ! 👋

J'ai trouvé une offre intéressante sur AgroLoopCI :

📦 ${offre.type_residu}
⚖️ ${formatNumber(offre.quantity_kg)} kg disponibles
💰 ${formatNumber(offre.price_fcfa)} FCFA
📍 ${offre.region}

Voir l'offre : ${url}

AgroLoopCI — Valorisation des résidus agricoles en Côte d'Ivoire 🌿`;

  const trackShare = () => {
    customFetch<{ share_count: number }>(`/api/offres/${offre.id}/share-view`, { method: "POST" })
      .catch(() => { /* ignore */ });
  };

  const onWhatsApp = () => {
    trackShare();
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackShare();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ description: "Impossible de copier le lien", variant: "destructive" });
    }
  };

  const onNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: offre.type_residu, text: message, url });
        trackShare();
      } catch { /* user cancelled */ }
    } else {
      onCopy();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl" data-testid="sheet-share-offer">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" /> Partager cette offre
          </SheetTitle>
        </SheetHeader>

        <div className="my-4 rounded-lg border bg-muted/30 p-4 flex gap-3">
          {offre.coverPhoto ? (
            <img src={offre.coverPhoto} alt={offre.type_residu} className="h-16 w-16 object-cover rounded-md flex-shrink-0" loading="lazy" />
          ) : (
            <div className="h-16 w-16 rounded-md bg-muted flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-semibold truncate">{offre.type_residu}</div>
            <div className="text-sm text-muted-foreground">{formatNumber(offre.quantity_kg)} kg · {formatNumber(offre.price_fcfa)} FCFA</div>
            <div className="text-xs text-muted-foreground">📍 {offre.region}</div>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            type="button"
            onClick={onWhatsApp}
            className="w-full gap-2 bg-[#25d366] hover:bg-[#1ebe5b] text-white"
            data-testid="button-share-whatsapp"
          >
            <MessageCircle className="h-4 w-4" /> 📱 Partager sur WhatsApp
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onCopy}
            className="w-full gap-2"
            data-testid="button-share-copy"
          >
            {copied ? (<><Check className="h-4 w-4" /> ✓ Lien copié !</>) : (<><LinkIcon className="h-4 w-4" /> 🔗 Copier le lien</>)}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onNative}
            className="w-full gap-2"
            data-testid="button-share-native"
          >
            <Share2 className="h-4 w-4" /> ↗️ Autres applications
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ShareButton({ offre, variant = "icon", className }: { offre: Props["offre"]; variant?: "icon" | "full"; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
          aria-label="Partager"
          title="Partager cette offre"
          className={`inline-flex items-center justify-center rounded-full bg-white/90 hover:bg-white shadow-sm w-8 h-8 backdrop-blur-sm ${className ?? ""}`}
          data-testid={`button-share-offer-${offre.id}`}
        >
          <Share2 className="h-4 w-4 text-muted-foreground" />
        </button>
      ) : (
        <Button type="button" variant="outline" onClick={() => setOpen(true)} className={`gap-2 ${className ?? ""}`} data-testid={`button-share-offer-${offre.id}`}>
          <Share2 className="h-4 w-4" /> 📤 Partager
        </Button>
      )}
      <ShareModal open={open} onOpenChange={setOpen} offre={offre} />
    </>
  );
}
