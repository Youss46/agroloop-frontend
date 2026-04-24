import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox, Clock, ShieldCheck } from "lucide-react";
import { devisApi, devisStatusLabel, formatFcfa, countdownString } from "@/lib/devis-api";

const TABS: { key: string; label: string }[] = [
  { key: "en_attente", label: "⏳ À traiter" },
  { key: "contre_proposé", label: "🔵 En attente acheteur" },
  { key: "accepté", label: "✅ Acceptés" },
  { key: "refusé", label: "❌ Refusés" },
  { key: "expiré", label: "⏰ Expirés" },
  { key: "tous", label: "Tous" },
];

export default function DevisRecusPage() {
  const [status, setStatus] = useState<string>("en_attente");
  const { data, isLoading } = useQuery({
    queryKey: ["devis", "recus", status],
    queryFn: () => devisApi.recus(status),
  });

  return (
    <div className="container py-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Demandes de devis reçues</h1>
          <p className="text-muted-foreground mt-1">Les acheteurs vous proposent un prix pour vos résidus. Répondez sous 48h.</p>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 border-b pb-3 -mx-4 px-4">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition ${
                status === t.key ? "bg-emerald-600 text-white" : "bg-muted hover:bg-muted/80 text-foreground"
              }`}
              data-testid={`tab-recus-${t.key}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : data && data.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-muted rounded-xl">
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg">Aucune demande de devis</h3>
            <p className="text-muted-foreground text-sm mt-1">Publiez plus d'offres pour recevoir des propositions de prix.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.map(d => {
              const badge = devisStatusLabel(d.status);
              const timeInfo = d.status === "en_attente" ? countdownString(d.expires_at) : null;
              const priceDiff = d.price_fcfa - d.offre.seller_price_fcfa;
              const priceRatio = d.offre.seller_price_fcfa > 0 ? (priceDiff / d.offre.seller_price_fcfa) * 100 : 0;
              return (
                <Link key={d.id} href={`/devis/${d.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-devis-recu-${d.id}`}>
                    <CardContent className="p-4 flex gap-4 items-center">
                      <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <Inbox className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">{d.reference}</span>
                          <Badge variant="outline" className={badge.color}>{badge.emoji} {badge.label}</Badge>
                          {d.other_party.verification_level >= 2 && (
                            <span className="flex items-center gap-1 text-xs text-emerald-700">
                              <ShieldCheck className="h-3.5 w-3.5" />Vérifié
                            </span>
                          )}
                        </div>
                        <div className="font-semibold mt-1 truncate">
                          {d.other_party.name} · {d.offre.type_residu}
                        </div>
                        <div className="text-sm text-muted-foreground tabular-nums">
                          Propose {formatFcfa(d.quantity_kg)}kg × <span className="font-semibold text-foreground">{formatFcfa(d.price_fcfa)} FCFA</span>
                          {" = "}{formatFcfa(d.total_fcfa)} FCFA
                        </div>
                        <div className={`text-xs mt-0.5 ${priceRatio >= 0 ? "text-emerald-600" : priceRatio >= -20 ? "text-orange-600" : "text-red-600"}`}>
                          {priceRatio >= 0 ? "+" : ""}{priceRatio.toFixed(0)}% vs votre prix ({formatFcfa(d.offre.seller_price_fcfa)} FCFA/kg)
                        </div>
                      </div>
                      <div className="text-right shrink-0 text-sm">
                        {timeInfo && (
                          <div className={`flex items-center gap-1 justify-end font-medium ${timeInfo.color}`}>
                            <Clock className="h-3.5 w-3.5" />
                            <span>{timeInfo.text}</span>
                          </div>
                        )}
                        {d.status === "en_attente" && (
                          <Button size="sm" className="mt-2 bg-emerald-600 hover:bg-emerald-700">Répondre →</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
  );
}
