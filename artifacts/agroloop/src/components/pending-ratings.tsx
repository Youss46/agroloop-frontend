import { useState } from "react";
import { useGetPendingRatings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, MessageSquareQuote } from "lucide-react";
import { RatingModal } from "./rating-modal";

export function PendingRatings() {
  const { data: pending, isLoading } = useGetPendingRatings();
  const [active, setActive] = useState<{
    transactionId: number;
    otherPartyId: number;
    otherPartyName: string;
  } | null>(null);

  if (isLoading || !pending || pending.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-none shadow-sm ring-1 ring-primary/30 bg-primary/5 mb-6" data-testid="card-pending-ratings">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" fill="#16a34a" />
            Avis en attente ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.map((p) => (
            <div
              key={p.transactionId}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-card ring-1 ring-border/50"
              data-testid={`item-pending-${p.transactionId}`}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{p.offerTitle}</div>
                <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                  <MessageSquareQuote className="h-3 w-3" />
                  Évaluez {p.otherPartyName}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  setActive({
                    transactionId: p.transactionId,
                    otherPartyId: p.otherPartyId,
                    otherPartyName: p.otherPartyName,
                  })
                }
                data-testid={`button-rate-${p.transactionId}`}
              >
                <Star className="h-4 w-4 mr-1" />
                Noter
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {active && (
        <RatingModal
          open={!!active}
          onOpenChange={(o) => !o && setActive(null)}
          transactionId={active.transactionId}
          otherPartyId={active.otherPartyId}
          otherPartyName={active.otherPartyName}
        />
      )}
    </>
  );
}
