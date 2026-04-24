import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { devisApi, devisStatusLabel, formatFcfa, countdownString, priceFeedback } from "@/lib/devis-api";
import { FileText, Clock, ArrowLeft, CheckCircle2, XCircle, RotateCw, ShieldCheck, Loader2, Phone, Package } from "lucide-react";

export default function DevisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const devisId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["devis", "detail", devisId],
    queryFn: () => devisApi.detail(devisId),
    enabled: Number.isFinite(devisId),
  });

  const [refuseOpen, setRefuseOpen] = useState(false);
  const [refuseNote, setRefuseNote] = useState("");
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterQty, setCounterQty] = useState<number>(0);
  const [counterPrice, setCounterPrice] = useState<number>(0);
  const [counterNote, setCounterNote] = useState("");
  const [refuseCounterOpen, setRefuseCounterOpen] = useState(false);
  const [refuseCounterNote, setRefuseCounterNote] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["devis"] });
  };

  const mutAccept = useMutation({
    mutationFn: () => devisApi.accepter(devisId),
    onSuccess: () => {
      toast({ title: "✅ Devis accepté", description: "Transaction créée, contrat en cours de génération." });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Action impossible", variant: "destructive" }),
  });

  const mutRefuse = useMutation({
    mutationFn: () => devisApi.refuser(devisId, refuseNote),
    onSuccess: () => {
      toast({ title: "Devis refusé", description: "L'acheteur a été notifié." });
      setRefuseOpen(false);
      setRefuseNote("");
      invalidate();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Action impossible", variant: "destructive" }),
  });

  const mutCounter = useMutation({
    mutationFn: () => devisApi.contreProposer(devisId, {
      counter_quantity_kg: counterQty,
      counter_price_fcfa: counterPrice,
      counter_note: counterNote.trim() || undefined,
    }),
    onSuccess: () => {
      toast({ title: "🔄 Contre-proposition envoyée", description: "L'acheteur doit maintenant répondre." });
      setCounterOpen(false);
      invalidate();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Action impossible", variant: "destructive" }),
  });

  const mutAcceptCounter = useMutation({
    mutationFn: () => devisApi.accepterContreProposition(devisId),
    onSuccess: () => {
      toast({ title: "✅ Contre-proposition acceptée", description: "Transaction créée, contrat en cours." });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Action impossible", variant: "destructive" }),
  });

  const mutRefuseCounter = useMutation({
    mutationFn: () => devisApi.refuserContreProposition(devisId, refuseCounterNote),
    onSuccess: () => {
      toast({ title: "Contre-proposition refusée", description: "Le vendeur a été notifié." });
      setRefuseCounterOpen(false);
      invalidate();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Action impossible", variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="container py-6 max-w-3xl space-y-4"><Skeleton className="h-10 w-40" /><Skeleton className="h-60" /></div>;
  }
  if (!data) {
    return <div className="container py-6 text-center"><p>Devis introuvable.</p></div>;
  }

  const badge = devisStatusLabel(data.status);
  const isProducteur = user?.role === "producteur" && data.producteur_id === user.id;
  const isTransformateur = user?.role === "transformateur" && data.transformateur_id === user.id;
  const timeInfo = (data.status === "en_attente") ? countdownString(data.expires_at) : null;

  function openCounter() {
    setCounterQty(data?.quantity_kg ?? 0);
    setCounterPrice(data?.offre.seller_price_fcfa ?? data?.price_fcfa ?? 0);
    setCounterNote("");
    setCounterOpen(true);
  }

  const counterFeedback = data.offre.seller_price_fcfa ? priceFeedback(counterPrice, data.offre.seller_price_fcfa) : null;
  const counterTotal = counterQty * counterPrice;

  return (
    <>
    <div className="container py-6 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => history.back()} className="mb-4" data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" />Retour
        </Button>

        <Card className="mb-4">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <FileText className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-lg font-mono">{data.reference}</CardTitle>
                <Badge variant="outline" className={badge.color}>{badge.emoji} {badge.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Créé le {new Date(data.created_at).toLocaleString("fr-FR")}</p>
            </div>
            {timeInfo && (
              <div className={`text-right flex items-center gap-1 font-medium ${timeInfo.color}`}>
                <Clock className="h-4 w-4" />
                <span>{timeInfo.text}</span>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Offer box */}
            <Link href={`/offres/${data.offre.id}`}>
              <div className="rounded-lg border bg-muted/30 p-3 hover:bg-muted/50 cursor-pointer transition">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Package className="h-4 w-4" />Offre liée : {data.offre.type_residu}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Région : {data.offre.region} · Stock : {formatFcfa(data.offre.quantity_kg)}kg ·
                  Prix vendeur : {formatFcfa(data.offre.seller_price_fcfa)} FCFA/kg
                </div>
              </div>
            </Link>

            {/* Parties */}
            <div className="grid md:grid-cols-2 gap-3">
              <PartyCard title="Acheteur (transformateur)" name={data.transformateur?.name} phone={data.transformateur?.phone} verified={(data.transformateur?.verificationLevel ?? 0) >= 2} reveal={data.status === "accepté" || data.status === "contre_proposé_accepté"} />
              <PartyCard title="Vendeur (producteur)" name={data.producteur?.name} phone={data.producteur?.phone} verified={(data.producteur?.verificationLevel ?? 0) >= 2} reveal={data.status === "accepté" || data.status === "contre_proposé_accepté"} />
            </div>

            {/* Original proposal */}
            <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50/50 p-4">
              <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Proposition de l'acheteur</div>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {formatFcfa(data.quantity_kg)} kg × {formatFcfa(data.price_fcfa)} FCFA/kg
              </div>
              <div className="text-lg text-emerald-900 font-semibold tabular-nums">= {formatFcfa(data.total_fcfa)} FCFA</div>
              {data.note && <div className="mt-2 text-sm italic text-muted-foreground">« {data.note} »</div>}
            </div>

            {/* Counter-proposal if present */}
            {data.status === "contre_proposé" || data.status === "contre_proposé_accepté" || data.status === "contre_proposé_refusé" ? (
              <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50/50 p-4">
                <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide flex items-center gap-1">
                  <RotateCw className="h-3.5 w-3.5" />Contre-proposition du vendeur
                </div>
                <div className="text-2xl font-bold tabular-nums mt-1">
                  {formatFcfa(data.counter_quantity_kg ?? 0)} kg × {formatFcfa(data.counter_price_fcfa ?? 0)} FCFA/kg
                </div>
                <div className="text-lg text-blue-900 font-semibold tabular-nums">= {formatFcfa(data.counter_total_fcfa ?? 0)} FCFA</div>
                {data.counter_note && <div className="mt-2 text-sm italic text-muted-foreground">« {data.counter_note} »</div>}
                {data.counter_response_note && data.status === "contre_proposé_refusé" && (
                  <div className="mt-2 text-sm text-red-700">Motif du refus : {data.counter_response_note}</div>
                )}
              </div>
            ) : null}

            {/* Refused reason */}
            {data.status === "refusé" && data.response_note && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                <span className="font-semibold text-red-900">Motif du refus :</span> {data.response_note}
              </div>
            )}

            {/* Accepted CTA */}
            {(data.status === "accepté" || data.status === "contre_proposé_accepté") && (
              <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                <div className="font-semibold text-emerald-900">Devis accepté — transaction en cours</div>
                <p className="text-sm text-emerald-700 mt-1">Le contrat PDF est en cours de génération. Retrouvez-le dans vos transactions.</p>
                <Link href="/transactions">
                  <Button size="sm" className="mt-3 bg-emerald-600 hover:bg-emerald-700">Voir mes transactions</Button>
                </Link>
              </div>
            )}

            {/* Actions — producteur on en_attente */}
            {isProducteur && data.status === "en_attente" && (
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                <Button onClick={() => mutAccept.mutate()} disabled={mutAccept.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid="button-accept">
                  {mutAccept.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}<CheckCircle2 className="h-4 w-4 mr-1" />Accepter
                </Button>
                <Button onClick={openCounter} variant="outline" className="flex-1 border-blue-500 text-blue-700 hover:bg-blue-50" data-testid="button-counter">
                  <RotateCw className="h-4 w-4 mr-1" />Contre-proposer
                </Button>
                <Button onClick={() => setRefuseOpen(true)} variant="outline" className="flex-1 border-red-500 text-red-700 hover:bg-red-50" data-testid="button-refuse">
                  <XCircle className="h-4 w-4 mr-1" />Refuser
                </Button>
              </div>
            )}

            {/* Actions — transformateur on contre_proposé */}
            {isTransformateur && data.status === "contre_proposé" && (
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                <Button onClick={() => mutAcceptCounter.mutate()} disabled={mutAcceptCounter.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid="button-accept-counter">
                  {mutAcceptCounter.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}<CheckCircle2 className="h-4 w-4 mr-1" />Accepter la contre-proposition
                </Button>
                <Button onClick={() => setRefuseCounterOpen(true)} variant="outline" className="flex-1 border-red-500 text-red-700 hover:bg-red-50" data-testid="button-refuse-counter">
                  <XCircle className="h-4 w-4 mr-1" />Refuser
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Refuse dialog (producteur) */}
      <Dialog open={refuseOpen} onOpenChange={setRefuseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser le devis</DialogTitle>
            <DialogDescription>Ajoutez une raison pour informer l'acheteur (optionnel).</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            maxLength={300}
            value={refuseNote}
            onChange={(e) => setRefuseNote(e.target.value)}
            placeholder="Ex : Quantité trop faible, prix insuffisant, résidus déjà réservés..."
            data-testid="input-refuse-note"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefuseOpen(false)}>Annuler</Button>
            <Button onClick={() => mutRefuse.mutate()} disabled={mutRefuse.isPending} className="bg-red-600 hover:bg-red-700" data-testid="button-confirm-refuse">
              {mutRefuse.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Counter-propose dialog (producteur) */}
      <Dialog open={counterOpen} onOpenChange={setCounterOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RotateCw className="h-5 w-5 text-blue-600" />Faire une contre-proposition</DialogTitle>
            <DialogDescription>Proposez votre propre prix ou quantité à l'acheteur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="c-qty">Quantité (kg)</Label>
              <Input id="c-qty" type="number" min={1} max={data.offre.quantity_kg} value={counterQty}
                onChange={(e) => setCounterQty(Number(e.target.value))} data-testid="input-counter-qty" />
              <p className="text-xs text-muted-foreground mt-1">Disponible : {formatFcfa(data.offre.quantity_kg)}kg</p>
            </div>
            <div>
              <Label htmlFor="c-price">Prix (FCFA/kg)</Label>
              <Input id="c-price" type="number" min={1} value={counterPrice}
                onChange={(e) => setCounterPrice(Number(e.target.value))}
                className="text-lg font-semibold tabular-nums" data-testid="input-counter-price" />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-muted-foreground">Acheteur proposait {formatFcfa(data.price_fcfa)} FCFA/kg</p>
                {counterFeedback?.label && <span className={`text-xs font-medium ${counterFeedback.color}`}>{counterFeedback.label}</span>}
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
              <div className="text-xs text-blue-800">Total</div>
              <div className="text-xl font-bold text-blue-900 tabular-nums mt-1">{formatFcfa(counterTotal)} FCFA</div>
            </div>
            <div>
              <Label htmlFor="c-note">Note (optionnel)</Label>
              <Textarea id="c-note" rows={3} maxLength={300} value={counterNote}
                onChange={(e) => setCounterNote(e.target.value)} data-testid="input-counter-note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCounterOpen(false)}>Annuler</Button>
            <Button onClick={() => mutCounter.mutate()} disabled={mutCounter.isPending} className="bg-blue-600 hover:bg-blue-700" data-testid="button-confirm-counter">
              {mutCounter.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Envoyer la contre-proposition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refuse counter (transformateur) */}
      <Dialog open={refuseCounterOpen} onOpenChange={setRefuseCounterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la contre-proposition</DialogTitle>
            <DialogDescription>Ajoutez une raison (optionnel).</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} maxLength={300} value={refuseCounterNote}
            onChange={(e) => setRefuseCounterNote(e.target.value)}
            placeholder="Ex : Prix trop élevé, besoin plus urgent..."
            data-testid="input-refuse-counter-note" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefuseCounterOpen(false)}>Annuler</Button>
            <Button onClick={() => mutRefuseCounter.mutate()} disabled={mutRefuseCounter.isPending} className="bg-red-600 hover:bg-red-700" data-testid="button-confirm-refuse-counter">
              {mutRefuseCounter.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Refuser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PartyCard({ title, name, phone, verified, reveal }: { title: string; name?: string; phone?: string | null; verified: boolean; reveal: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{title}</div>
      <div className="font-semibold mt-1 flex items-center gap-1.5">
        {name ?? "—"}
        {verified && <ShieldCheck className="h-4 w-4 text-emerald-600" />}
      </div>
      {phone && reveal && (
        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
          <Phone className="h-3.5 w-3.5" />
          <a href={`tel:${phone}`} className="text-emerald-700 hover:underline">{phone}</a>
        </div>
      )}
      {!reveal && <div className="text-xs text-muted-foreground mt-1 italic">Coordonnées visibles après acceptation</div>}
    </div>
  );
}
