import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Clock, TrendingDown } from "lucide-react";
import { devisApi, devisStatusLabel, formatFcfa, countdownString, type DevisStatus } from "@/lib/devis-api";

const TABS: { key: string; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "en_attente", label: "⏳ En attente" },
  { key: "contre_proposé", label: "🔵 Contre-proposés" },
  { key: "accepté", label: "✅ Acceptés" },
  { key: "refusé", label: "❌ Refusés" },
  { key: "expiré", label: "⏰ Expirés" },
];

export default function MesDevisPage() {
  const [status, setStatus] = useState<string>("tous");
  const { data, isLoading } = useQuery({
    queryKey: ["devis", "mes-devis", status],
    queryFn: () => devisApi.mesDevis(status),
  });

  return (
    <div className="container py-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Mes demandes de devis</h1>
          <p className="text-muted-foreground mt-1">Suivi de toutes vos offres de prix envoyées aux vendeurs.</p>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 border-b pb-3 -mx-4 px-4">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition ${
                status === t.key ? "bg-emerald-600 text-white" : "bg-muted hover:bg-muted/80 text-foreground"
              }`}
              data-testid={`tab-status-${t.key}`}
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
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {data?.map(d => {
              const badge = devisStatusLabel(d.status);
              const timeInfo = d.status === "en_attente" ? countdownString(d.expires_at) : null;
              return (
                <Link key={d.id} href={`/devis/${d.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-devis-${d.id}`}>
                    <CardContent className="p-4 flex gap-4 items-center">
                      <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">{d.reference}</span>
                          <Badge variant="outline" className={badge.color}>{badge.emoji} {badge.label}</Badge>
                        </div>
                        <div className="font-semibold mt-1 truncate">{d.offre.type_residu} · {d.other_party.name}</div>
                        <div className="text-sm text-muted-foreground tabular-nums">
                          Ma proposition : {formatFcfa(d.quantity_kg)}kg × {formatFcfa(d.price_fcfa)} FCFA = {formatFcfa(d.total_fcfa)} FCFA
                        </div>
                        {d.note && <div className="text-xs italic text-muted-foreground truncate mt-0.5">« {d.note} »</div>}
                      </div>
                      <div className="text-right shrink-0 text-sm">
                        {timeInfo && (
                          <div className={`flex items-center gap-1 justify-end ${timeInfo.color}`}>
                            <Clock className="h-3.5 w-3.5" />
                            <span>{timeInfo.text}</span>
                          </div>
                        )}
                        {d.status === "accepté" && d.responded_at && (
                          <div className="text-emerald-600">✅ Accepté<br/><span className="text-xs text-muted-foreground">{new Date(d.responded_at).toLocaleDateString("fr-FR")}</span></div>
                        )}
                        {d.status === "refusé" && (
                          <div className="text-red-600">❌ Refusé{d.response_note && <div className="text-xs text-muted-foreground truncate max-w-[160px]">{d.response_note}</div>}</div>
                        )}
                        {d.status === "contre_proposé" && (
                          <div className="text-blue-700 font-medium flex items-center gap-1 justify-end">
                            <TrendingDown className="h-3.5 w-3.5" />À examiner
                          </div>
                        )}
                        {d.status === "expiré" && d.expires_at && (
                          <div className="text-gray-500 text-xs">⏰ Expiré le {new Date(d.expires_at).toLocaleDateString("fr-FR")}</div>
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

function EmptyState() {
  return (
    <div className="text-center py-12 border-2 border-dashed border-muted rounded-xl">
      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
      <h3 className="font-semibold text-lg">Aucune demande de devis</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">Parcourez la marketplace pour trouver des offres et envoyer vos premières demandes de prix.</p>
      <Link href="/marketplace">
        <Button className="bg-emerald-600 hover:bg-emerald-700">Explorer la marketplace</Button>
      </Link>
    </div>
  );
}
