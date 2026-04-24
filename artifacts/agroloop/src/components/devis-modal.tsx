import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Clock } from "lucide-react";
import { devisApi, formatFcfa, priceFeedback } from "@/lib/devis-api";
import { useLocation } from "wouter";

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
  defaultPrice?: number;
  defaultNote?: string;
  onCreated?: () => void;
}

export function DevisModal({ open, onOpenChange, offre, defaultQuantity, defaultPrice, defaultNote, onCreated }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [quantity, setQuantity] = useState<number>(defaultQuantity ?? Math.min(100, offre.quantity_kg));
  const [price, setPrice] = useState<number>(defaultPrice ?? offre.price_fcfa);
  const [note, setNote] = useState<string>(defaultNote ?? "");

  useEffect(() => {
    if (open) {
      setQuantity(defaultQuantity ?? Math.min(100, offre.quantity_kg));
      setPrice(defaultPrice ?? offre.price_fcfa);
      setNote(defaultNote ?? "");
    }
  }, [open, offre.id]); // eslint-disable-line

  const total = useMemo(() => (Number.isFinite(quantity) && Number.isFinite(price)) ? quantity * price : 0, [quantity, price]);
  const feedback = priceFeedback(price, offre.price_fcfa);

  const mut = useMutation({
    mutationFn: () => devisApi.create({
      offre_id: offre.id,
      quantity_kg: quantity,
      price_fcfa: price,
      note: note.trim() || undefined,
    }),
    onSuccess: (d) => {
      toast({ title: "✓ Demande de devis envoyée", description: `À ${offre.seller_name}. Référence : ${d.reference}` });
      qc.invalidateQueries({ queryKey: ["devis", "active-for-offre", offre.id] });
      qc.invalidateQueries({ queryKey: ["devis", "mes-devis"] });
      onOpenChange(false);
      onCreated?.();
    },
    onError: (e: any) => {
      toast({ title: "Erreur", description: e?.message ?? "Impossible d'envoyer la demande.", variant: "destructive" });
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
    if (!Number.isFinite(price) || price <= 0) {
      toast({ title: "Prix invalide", description: "Le prix doit être supérieur à 0.", variant: "destructive" });
      return;
    }
    mut.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-devis">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            Faire une offre de prix
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
            <Label htmlFor="d-qty">Quantité souhaitée (kg)</Label>
            <Input
              id="d-qty"
              type="number"
              min={1}
              max={offre.quantity_kg}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              data-testid="input-devis-quantity"
            />
            <p className="text-xs text-muted-foreground mt-1">Disponible : {formatFcfa(offre.quantity_kg)}kg</p>
          </div>

          <div>
            <Label htmlFor="d-price">Votre prix proposé (FCFA/kg)</Label>
            <Input
              id="d-price"
              type="number"
              min={1}
              step={1}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="text-lg font-semibold tabular-nums"
              data-testid="input-devis-price"
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-muted-foreground">Prix vendeur : {formatFcfa(offre.price_fcfa)} FCFA/kg</p>
              {feedback.label && <span className={`text-xs font-medium ${feedback.color}`}>{feedback.label}</span>}
            </div>
          </div>

          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
            <div className="text-xs text-emerald-800">Total estimé</div>
            <div className="text-2xl font-bold text-emerald-900 tabular-nums mt-1">
              {formatFcfa(quantity || 0)} × {formatFcfa(price || 0)} = {formatFcfa(total)} FCFA
            </div>
          </div>

          <div>
            <Label htmlFor="d-note">Note au vendeur (optionnel)</Label>
            <Textarea
              id="d-note"
              rows={3}
              maxLength={300}
              placeholder="Ex : Résidus triés et secs souhaités, livraison possible ?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              data-testid="input-devis-note"
            />
            <p className="text-xs text-muted-foreground mt-1">{note.length}/300 caractères</p>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-2">
            <Clock className="h-3.5 w-3.5" />
            <span>Le vendeur aura 48h pour répondre à votre demande.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-devis-cancel">
            Annuler
          </Button>
          <Button onClick={submit} disabled={mut.isPending} className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-devis-submit">
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Envoyer ma demande de devis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
