import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Flag, Loader2 } from "lucide-react";

const REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "Spam ou doublon" },
  { value: "fraude_arnaque", label: "Fraude / Arnaque" },
  { value: "contenu_inapproprié", label: "Contenu inapproprié" },
  { value: "produit_interdit", label: "Produit interdit" },
  { value: "informations_trompeuses", label: "Informations trompeuses" },
  { value: "autre", label: "Autre" },
];

export function ReportOfferButton({ offreId }: { offreId: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");

  const submit = useMutation({
    mutationFn: () => customFetch(`/api/offres/${offreId}/flag`, {
      method: "POST",
      body: JSON.stringify({ reason, comment }),
    }),
    onSuccess: () => {
      toast({ title: "Merci pour votre signalement", description: "Notre équipe va examiner cette offre." });
      setOpen(false);
      setReason("");
      setComment("");
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e?.data?.error ?? e?.message ?? "Impossible d'envoyer le signalement" }),
  });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
        data-testid="button-report-offer"
      >
        <Flag className="h-4 w-4" /> Signaler cette offre
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signaler cette offre</DialogTitle>
            <DialogDescription>
              Aidez-nous à garder AgroLoopCI sûr. Indiquez le motif de votre signalement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={reason} onValueChange={setReason}>
              {REASONS.map((r) => (
                <div key={r.value} className="flex items-center gap-2">
                  <RadioGroupItem value={r.value} id={`reason-${r.value}`} data-testid={`radio-${r.value}`} />
                  <Label htmlFor={`reason-${r.value}`} className="cursor-pointer text-sm">{r.label}</Label>
                </div>
              ))}
            </RadioGroup>
            <div>
              <Label htmlFor="comment" className="text-sm">Commentaire (optionnel)</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Précisez le problème…"
                rows={3}
                maxLength={500}
                data-testid="textarea-report-comment"
              />
              <div className="text-xs text-muted-foreground mt-1 text-right">{comment.length}/500</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button
              onClick={() => submit.mutate()}
              disabled={!reason || submit.isPending}
              data-testid="button-submit-report"
            >
              {submit.isPending && <Loader2 className="animate-spin h-3 w-3 mr-1" />}
              Envoyer le signalement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
