import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShoppingCart, Plus, Minus } from "lucide-react";
import { cartApi, formatFcfa } from "@/lib/orders-api";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  offre: {
    id: number;
    type_residu: string;
    quantity_kg: number;
    price_fcfa: number;
    seller_name: string;
  };
  defaultQuantity?: number;
  defaultNote?: string;
  onAdded?: () => void;
}

export function AddToCartModal({ open, onOpenChange, offre, defaultQuantity, defaultNote, onAdded }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState<number>(defaultQuantity ?? Math.min(100, offre.quantity_kg));
  const [note, setNote] = useState<string>(defaultNote ?? "");

  useEffect(() => {
    if (open) {
      setQuantity(defaultQuantity ?? Math.min(100, offre.quantity_kg));
      setNote(defaultNote ?? "");
    }
  }, [open, offre.id]); // eslint-disable-line

  const total = useMemo(() => (Number.isFinite(quantity) && quantity > 0) ? quantity * offre.price_fcfa : 0, [quantity, offre.price_fcfa]);

  const mut = useMutation({
    mutationFn: () => cartApi.add({
      offre_id: offre.id,
      quantity_kg: quantity,
      note: note.trim() || undefined,
    }),
    onSuccess: () => {
      toast({ title: "✓ Ajouté au panier", description: `${formatFcfa(quantity)}kg de ${offre.type_residu}` });
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-count"] });
      onOpenChange(false);
      onAdded?.();
    },
    onError: (e: any) => {
      toast({ title: "Erreur", description: e?.message ?? "Impossible d'ajouter au panier.", variant: "destructive" });
    },
  });

  function submit() {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ title: "Quantité invalide", description: "La quantité doit être supérieure à 0.", variant: "destructive" });
      return;
    }
    if (quantity > offre.quantity_kg) {
      toast({ title: "Quantité trop élevée", description: `Disponible : ${formatFcfa(offre.quantity_kg)}kg`, variant: "destructive" });
      return;
    }
    mut.mutate();
  }

  const adjust = (delta: number) => {
    const next = Math.max(1, Math.min(offre.quantity_kg, (Number.isFinite(quantity) ? quantity : 0) + delta));
    setQuantity(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-add-to-cart">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-emerald-600" />
            Ajouter au panier
          </DialogTitle>
          <DialogDescription>
            {offre.type_residu} · {offre.seller_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div><span className="text-muted-foreground">Disponible : </span><span className="font-medium tabular-nums">{formatFcfa(offre.quantity_kg)} kg</span></div>
            <div><span className="text-muted-foreground">Prix vendeur : </span><span className="font-medium tabular-nums">{formatFcfa(offre.price_fcfa)} FCFA/kg</span></div>
          </div>

          <div>
            <Label htmlFor="c-qty">Quantité souhaitée (kg)</Label>
            <div className="flex items-center gap-2 mt-1">
              <Button type="button" size="icon" variant="outline" onClick={() => adjust(-10)} aria-label="Diminuer de 10" data-testid="button-qty-minus">
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="c-qty"
                type="number"
                min={1}
                max={offre.quantity_kg}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="text-center text-lg font-semibold tabular-nums"
                data-testid="input-cart-quantity"
              />
              <Button type="button" size="icon" variant="outline" onClick={() => adjust(+10)} className="bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100" aria-label="Augmenter de 10" data-testid="button-qty-plus">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Max : {formatFcfa(offre.quantity_kg)}kg</p>
          </div>

          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
            <div className="text-xs text-emerald-800">Total estimé</div>
            <div className="text-2xl font-bold text-emerald-900 tabular-nums mt-1">
              {formatFcfa(total)} FCFA
            </div>
          </div>

          <div>
            <Label htmlFor="c-note">Note au vendeur (optionnel)</Label>
            <Textarea
              id="c-note"
              rows={3}
              maxLength={300}
              placeholder="Ex : Résidus bien triés souhaités"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              data-testid="input-cart-note"
            />
            <p className="text-xs text-muted-foreground mt-1">{note.length}/300 caractères</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cart-cancel">
            Annuler
          </Button>
          <Button onClick={submit} disabled={mut.isPending} className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-cart-add">
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Ajouter au panier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
