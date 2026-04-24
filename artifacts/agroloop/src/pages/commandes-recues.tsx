import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Package, MapPin, CheckCircle2, XCircle, MessageSquareQuote, Clock, Inbox,
} from "lucide-react";
import { ordersApi, formatFcfa, orderItemStatusLabel, countdown48h, type ReceivedOrderItem } from "@/lib/orders-api";
import { VerificationBadge } from "@/components/verification-badge";

export default function CommandesRecuesPage() {
  const [filter, setFilter] = useState<string>("en_attente");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["orders", "received", filter],
    queryFn: () => ordersApi.received(filter),
  });

  return (
    <div className="container py-6 md:py-10 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Inbox className="h-7 w-7 text-emerald-600" />
          Demandes reçues
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Répondez aux commandes des transformateurs sous 48h.</p>
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList>
          <TabsTrigger value="en_attente" data-testid="tab-pending">⏳ À répondre</TabsTrigger>
          <TabsTrigger value="acceptée" data-testid="tab-accepted">✅ Acceptées</TabsTrigger>
          <TabsTrigger value="refusée" data-testid="tab-refused">❌ Refusées</TabsTrigger>
          <TabsTrigger value="contre_proposée" data-testid="tab-countered">🔄 Contre-propositions</TabsTrigger>
          <TabsTrigger value="tous" data-testid="tab-all">Tout</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <Card className="border-dashed bg-red-50 border-red-200">
          <CardContent className="p-8 text-center">
            <XCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{(error as any)?.message ?? "Impossible de charger les demandes."}</p>
            <Button variant="outline" onClick={() => refetch()} className="mt-4">Réessayer</Button>
          </CardContent>
        </Card>
      ) : !data || data.length === 0 ? (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="p-12 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">Aucune demande dans cette catégorie.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.map((item: ReceivedOrderItem) => <ReceivedOrderItemCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}

function ReceivedOrderItemCard({ item }: { item: ReceivedOrderItem }) {
  const [open, setOpen] = useState<null | "accepter" | "refuser" | "contre_proposer">(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const statusInfo = orderItemStatusLabel(item.status);
  const countdown = item.status === "en_attente" && item.order ? countdown48h(item.order.created_at) : null;

  const respondMut = useMutation({
    mutationFn: (body: Parameters<typeof ordersApi.respond>[1]) => ordersApi.respond(item.id, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      setOpen(null);
      const labels = { accepter: "✓ Commande acceptée", refuser: "Commande refusée", contre_proposer: "Contre-proposition envoyée" };
      toast({ title: labels[vars.action] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Action impossible", variant: "destructive" }),
  });

  return (
    <Card data-testid={`received-item-${item.id}`}>
      <CardHeader className="pb-3 border-b">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
              {item.buyer?.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{item.buyer?.name ?? "Acheteur"}</span>
                {item.buyer && <VerificationBadge level={item.buyer.verification_level} size="sm" />}
              </div>
              <div className="text-xs text-muted-foreground">
                {item.order?.reference} · {item.order ? new Date(item.order.created_at).toLocaleDateString("fr-FR") : ""}
              </div>
            </div>
          </div>
          <div className="text-right">
            <Badge className={statusInfo.color}>{statusInfo.emoji} {statusInfo.label}</Badge>
            {countdown && !countdown.expired && (
              <div className={`text-xs mt-1 flex items-center gap-1 justify-end ${countdown.color}`}>
                <Clock className="h-3 w-3" /> {countdown.text}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 h-14 w-14 rounded bg-muted overflow-hidden">
            {item.offer.cover_photo_url ? (
              <img src={item.offer.cover_photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                <Package className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{item.offer.type_residu}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {item.offer.region}
            </div>
            <div className="text-sm mt-1">
              Quantité demandée : <span className="font-semibold tabular-nums">{formatFcfa(item.quantity_kg)}kg</span> à <span className="tabular-nums">{formatFcfa(item.unit_price_fcfa)} FCFA/kg</span>
            </div>
          </div>
          <div className="text-right tabular-nums">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="font-bold text-lg">{formatFcfa(item.total_fcfa)}</div>
            <div className="text-xs text-muted-foreground">FCFA</div>
          </div>
        </div>

        {item.order?.note_globale && (
          <div className="mt-3 text-sm bg-muted/40 rounded p-2 italic">
            "{item.order.note_globale}"
          </div>
        )}

        {item.status === "en_attente" && !countdown?.expired && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpen("accepter")} data-testid={`button-accept-${item.id}`}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Accepter
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen("contre_proposer")} data-testid={`button-counter-${item.id}`}>
              <MessageSquareQuote className="h-4 w-4 mr-2" /> Contre-proposer
            </Button>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setOpen("refuser")} data-testid={`button-refuse-${item.id}`}>
              <XCircle className="h-4 w-4 mr-2" /> Refuser
            </Button>
          </div>
        )}

        {item.status === "contre_proposée" && item.counter_quantity_kg != null && item.counter_price_fcfa != null && (
          <div className="mt-3 border-l-4 border-blue-500 bg-blue-50 rounded-r p-3 text-sm">
            <div className="font-semibold text-blue-900 mb-1">Votre contre-proposition</div>
            <div>{formatFcfa(item.counter_quantity_kg)}kg × {formatFcfa(item.counter_price_fcfa)} FCFA/kg = <span className="font-bold">{formatFcfa(item.counter_quantity_kg * item.counter_price_fcfa)} FCFA</span></div>
            {item.counter_note && <div className="italic mt-1">"{item.counter_note}"</div>}
            <div className="text-xs text-muted-foreground mt-1">En attente de réponse de l'acheteur</div>
          </div>
        )}
      </CardContent>

      <RespondDialog
        action={open}
        onClose={() => setOpen(null)}
        item={item}
        onSubmit={(body) => respondMut.mutate(body)}
        loading={respondMut.isPending}
      />
    </Card>
  );
}

function RespondDialog({
  action, onClose, item, onSubmit, loading,
}: {
  action: null | "accepter" | "refuser" | "contre_proposer";
  onClose: () => void;
  item: ReceivedOrderItem;
  onSubmit: (body: Parameters<typeof ordersApi.respond>[1]) => void;
  loading: boolean;
}) {
  const [counterQty, setCounterQty] = useState<number>(item.quantity_kg);
  const [counterPrice, setCounterPrice] = useState<number>(item.unit_price_fcfa);
  const [note, setNote] = useState("");

  const isCounter = action === "contre_proposer";
  const isRefuse = action === "refuser";
  const isAccept = action === "accepter";

  const submit = () => {
    if (isAccept) onSubmit({ action: "accepter" });
    else if (isRefuse) onSubmit({ action: "refuser", counter_note: note.trim() || undefined });
    else if (isCounter) {
      if (!(counterQty > 0) || !(counterPrice > 0)) return;
      onSubmit({ action: "contre_proposer", counter_quantity_kg: counterQty, counter_price_fcfa: counterPrice, counter_note: note.trim() || undefined });
    }
  };

  const title = isAccept ? "Accepter cette commande ?" : isRefuse ? "Refuser cette commande ?" : "Faire une contre-proposition";
  const newTotal = isCounter ? counterQty * counterPrice : 0;

  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-respond">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isAccept && "Un contrat sera généré automatiquement et le stock mis à jour."}
            {isRefuse && "L'acheteur sera notifié du refus."}
            {isCounter && "L'acheteur pourra accepter ou refuser votre contre-proposition."}
          </DialogDescription>
        </DialogHeader>

        {isAccept && (
          <div className="rounded bg-emerald-50 border border-emerald-200 p-3 text-sm">
            <div className="flex justify-between"><span>Quantité</span><span className="tabular-nums font-medium">{formatFcfa(item.quantity_kg)}kg</span></div>
            <div className="flex justify-between"><span>Prix</span><span className="tabular-nums font-medium">{formatFcfa(item.unit_price_fcfa)} FCFA/kg</span></div>
            <div className="flex justify-between text-base pt-2 mt-2 border-t border-emerald-200"><span>Total</span><span className="tabular-nums font-bold">{formatFcfa(item.total_fcfa)} FCFA</span></div>
          </div>
        )}

        {isCounter && (
          <div className="space-y-3">
            <div>
              <Label>Quantité proposée (kg)</Label>
              <Input type="number" min={1} value={counterQty} onChange={(e) => setCounterQty(Number(e.target.value))} data-testid="input-counter-qty" />
              <p className="text-xs text-muted-foreground mt-1">Demandé : {formatFcfa(item.quantity_kg)}kg</p>
            </div>
            <div>
              <Label>Prix unitaire (FCFA/kg)</Label>
              <Input type="number" min={1} value={counterPrice} onChange={(e) => setCounterPrice(Number(e.target.value))} data-testid="input-counter-price" />
              <p className="text-xs text-muted-foreground mt-1">Proposé : {formatFcfa(item.unit_price_fcfa)} FCFA/kg</p>
            </div>
            <div className="rounded bg-blue-50 border border-blue-200 p-3 text-sm flex justify-between">
              <span>Nouveau total</span>
              <span className="tabular-nums font-bold">{formatFcfa(newTotal)} FCFA</span>
            </div>
          </div>
        )}

        {(isCounter || isRefuse) && (
          <div>
            <Label htmlFor="r-note">{isRefuse ? "Motif du refus (optionnel)" : "Note (optionnel)"}</Label>
            <Textarea id="r-note" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} data-testid="input-respond-note" />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            onClick={submit}
            disabled={loading || (isCounter && (!(counterQty > 0) || !(counterPrice > 0)))}
            className={isRefuse ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}
            data-testid="button-submit-response"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
