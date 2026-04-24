import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "./star-rating";
import {
  useCreateRating,
  getGetPendingRatingsQueryKey,
  getGetUserRatingsQueryKey,
  getGetUserProfileQueryKey,
} from "@/api-client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: number;
  otherPartyName: string;
  otherPartyId: number;
}

export function RatingModal({
  open,
  onOpenChange,
  transactionId,
  otherPartyName,
  otherPartyId,
}: Props) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createRating = useCreateRating();

  const handleSubmit = async () => {
    if (stars < 1) {
      toast({
        title: "Note requise",
        description: "Veuillez sélectionner une note de 1 à 5 étoiles.",
        variant: "destructive",
      });
      return;
    }
    try {
      await createRating.mutateAsync({
        data: {
          transactionId,
          stars,
          comment: comment.trim() || null,
        },
      });
      toast({
        title: "Merci pour votre avis !",
        description: `Votre évaluation de ${otherPartyName} a été enregistrée.`,
      });
      queryClient.invalidateQueries({ queryKey: getGetPendingRatingsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetUserRatingsQueryKey(otherPartyId) });
      queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(otherPartyId) });
      setStars(0);
      setComment("");
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err?.message ?? "Impossible d'enregistrer l'avis",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-rating">
        <DialogHeader>
          <DialogTitle>Évaluer {otherPartyName}</DialogTitle>
          <DialogDescription>
            Partagez votre expérience pour aider la communauté.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <StarRating
            value={stars}
            onChange={setStars}
            readonly={false}
            size={40}
            showCount={false}
            showAvg={false}
          />
          <p className="text-sm text-muted-foreground h-4">
            {stars > 0 && ["", "Très mauvais", "Mauvais", "Correct", "Bien", "Très bien"][stars]}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Votre commentaire (optionnel)
          </label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 300))}
            placeholder="Décrivez votre expérience..."
            rows={4}
            data-testid="textarea-rating-comment"
          />
          <p className="text-xs text-muted-foreground text-right">
            {comment.length}/300
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-rating-later"
          >
            Plus tard
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createRating.isPending || stars < 1}
            data-testid="button-rating-submit"
          >
            {createRating.isPending ? "Envoi..." : "Soumettre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
