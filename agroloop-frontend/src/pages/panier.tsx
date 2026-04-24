import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart, Trash2, Plus, Minus, Loader2, Package, MapPin, Info, ArrowRight,
} from "lucide-react";
import { cartApi, ordersApi, formatFcfa, type CartItem, type CartGroup, type OrderDetail } from "@/lib/orders-api";
import { VerificationBadge } from "@/components/verification-badge";

const PLATFORM_FEE_RATE = 0.04;

export default function PanierPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [noteGlobale, setNoteGlobale] = useState("");

  const { data: cart, isLoading } = useQuery({ queryKey: ["cart"], queryFn: () => cartApi.get() });

  const updateMut = useMutation({
    mutationFn: ({ offreId, quantityKg, note }: { offreId: number; quantityKg: number; note?: string | null }) =>
      cartApi.update(offreId, { quantity_kg: quantityKg, note: note ?? undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-count"] });
    },
    onError: (e: any) => {
      // Re-sync local state with server on failure to prevent stale qty inputs
      qc.invalidateQueries({ queryKey: ["cart"] });
      toast({ title: "Erreur", description: e?.message ?? "Mise à jour impossible", variant: "destructive" });
    },
  });

  const removeMut = useMutation({
    mutationFn: (offreId: number) => cartApi.remove(offreId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-count"] });
      toast({ title: "Article retiré du panier" });
    },
  });

  const clearMut = useMutation({
    mutationFn: () => cartApi.clear(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-count"] });
      toast({ title: "Panier vidé" });
    },
  });

  const createOrderMut = useMutation({
    mutationFn: () => ordersApi.create({ note_globale: noteGlobale.trim() || undefined }),
    onSuccess: (order: OrderDetail) => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-count"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      setLocation(`/commandes/confirmation/${order.id}`);
    },
    onError: (e: any) => {
      toast({ title: "Commande impossible", description: e?.message ?? "Une erreur est survenue.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="container py-10 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isEmpty = !cart || cart.item_count === 0;

  if (isEmpty) {
    return (
      <div className="container py-10 max-w-3xl">
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <ShoppingCart className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h2 className="text-2xl font-semibold">Votre panier est vide</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">Explorez la marketplace et ajoutez des résidus pour les commander en une seule fois.</p>
            <Link href="/marketplace">
              <Button className="mt-6 gap-2" data-testid="button-goto-marketplace">
                <Package className="h-4 w-4" />
                Parcourir la marketplace
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const subtotal = cart.grand_total_fcfa;
  const fee = Math.round(subtotal * PLATFORM_FEE_RATE);
  const total = subtotal + fee;

  return (
    <div className="container py-6 md:py-10 max-w-6xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Mon panier</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {cart.item_count} article{cart.item_count > 1 ? "s" : ""} de {cart.seller_count} vendeur{cart.seller_count > 1 ? "s" : ""}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" data-testid="button-clear-cart">
              <Trash2 className="h-4 w-4 mr-2" />
              Vider le panier
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Vider complètement le panier ?</AlertDialogTitle>
              <AlertDialogDescription>Tous les articles seront retirés.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => clearMut.mutate()} className="bg-red-600 hover:bg-red-700">Vider</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {cart.groups.map((group: CartGroup) => (
            <Card key={group.producteur.id} data-testid={`cart-group-${group.producteur.id}`}>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                      {group.producteur.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{group.producteur.name}</span>
                        <VerificationBadge level={group.producteur.verification_level} size="sm" />
                      </div>
                      {group.producteur.region && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {group.producteur.region}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Sous-total</div>
                    <div className="font-semibold tabular-nums">{formatFcfa(group.subtotal_fcfa)} FCFA</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {group.items.map((item: CartItem) => (
                    <CartLineItem
                      key={item.id}
                      item={item}
                      onChangeQty={(q, note) => updateMut.mutate({ offreId: item.offre_id, quantityKg: q, note })}
                      onRemove={() => removeMut.mutate(item.offre_id)}
                      disabled={updateMut.isPending || removeMut.isPending}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <div className="sticky top-20">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Récapitulatif</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{cart.item_count} article{cart.item_count > 1 ? "s" : ""}</span>
                  <span className="tabular-nums">{formatFcfa(subtotal)} FCFA</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Commission plateforme (4%)</span>
                  <span className="tabular-nums">{formatFcfa(fee)} FCFA</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium">Total estimé</span>
                  <span className="text-xl font-bold tabular-nums">{formatFcfa(total)} FCFA</span>
                </div>

                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex gap-2">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Les prix sont indicatifs. Chaque vendeur peut accepter, refuser ou faire une contre-proposition.</span>
                </div>

                <div className="pt-2">
                  <Label htmlFor="p-note">Note globale (optionnel)</Label>
                  <Textarea
                    id="p-note"
                    rows={3}
                    maxLength={500}
                    placeholder="Ex : livraison urgente demandée, coordonnées logistiques…"
                    value={noteGlobale}
                    onChange={(e) => setNoteGlobale(e.target.value)}
                    data-testid="input-order-note-globale"
                  />
                </div>

                <Button
                  onClick={() => createOrderMut.mutate()}
                  disabled={createOrderMut.isPending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 mt-2"
                  size="lg"
                  data-testid="button-place-order"
                >
                  {createOrderMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                  Passer la commande
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Les vendeurs seront notifiés et auront 48h pour répondre à votre commande.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartLineItem({
  item, onChangeQty, onRemove, disabled,
}: {
  item: CartItem;
  onChangeQty: (q: number, note: string | null) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const [qty, setQty] = useState(item.quantity_kg);
  const max = item.offer.quantity_kg_available;

  const commit = (next: number) => {
    const clamped = Math.max(1, Math.min(max, next));
    setQty(clamped);
    if (clamped !== item.quantity_kg) onChangeQty(clamped, item.note);
  };

  return (
    <li className="p-4 flex items-start gap-3">
      <div className="shrink-0 h-12 w-12 rounded bg-muted overflow-hidden">
        {item.offer.cover_photo_url ? (
          <img src={item.offer.cover_photo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <Package className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{item.offer.type_residu}</div>
        {item.offer.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{item.offer.description}</p>
        )}
        <div className="text-xs text-muted-foreground mt-0.5">
          Prix unitaire : <span className="tabular-nums">{formatFcfa(item.offer.unit_price_fcfa)} FCFA/kg</span> · Stock : {formatFcfa(max)}kg
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => commit(qty - 10)} disabled={disabled || qty <= 1} aria-label="-10">
            <Minus className="h-3 w-3" />
          </Button>
          <Input
            type="number" min={1} max={max} value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            onBlur={() => commit(qty)}
            className="h-8 w-24 text-center tabular-nums"
            data-testid={`input-cart-qty-${item.offre_id}`}
          />
          <Button size="icon" variant="outline" className="h-8 w-8 bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100" onClick={() => commit(qty + 10)} disabled={disabled || qty >= max} aria-label="+10">
            <Plus className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground">kg</span>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="font-semibold tabular-nums">{formatFcfa(item.line_total_fcfa)}</div>
        <div className="text-xs text-muted-foreground">FCFA</div>
        <Button size="icon" variant="ghost" className="mt-1 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={onRemove} disabled={disabled} aria-label="Retirer" data-testid={`button-remove-item-${item.offre_id}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
