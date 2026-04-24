import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { adminApi } from "@/lib/admin-api";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Flag, Trash2, Star, AlertTriangle, ExternalLink } from "lucide-react";

const REASON_LABELS: Record<string, string> = {
  spam: "Spam / Doublon",
  fraude_arnaque: "Fraude / Arnaque",
  contenu_inapproprié: "Contenu inapproprié",
  produit_interdit: "Produit interdit",
  informations_trompeuses: "Informations trompeuses",
  autre: "Autre",
};

export default function AdminAvis() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("avis");
  const [filters, setFilters] = useState<any>({ page: 1 });
  const [reviewFlag, setReviewFlag] = useState<any>(null);
  const [decision, setDecision] = useState("");
  const [removeOffer, setRemoveOffer] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-ratings", filters],
    queryFn: () => adminApi.listRatings(filters),
    enabled: tab === "avis",
  });

  const { data: flagsData, isLoading: flagsLoading } = useQuery({
    queryKey: ["admin-flagged-offers", "en_attente"],
    queryFn: () => adminApi.listFlaggedOffers({ status: "en_attente" }),
    enabled: tab === "offres",
  });

  const { data: flagsTreated } = useQuery({
    queryKey: ["admin-flagged-offers", "traité"],
    queryFn: () => adminApi.listFlaggedOffers({ status: "traité" }),
    enabled: tab === "offres",
  });

  const flag = useMutation({
    mutationFn: ({ id, flagged }: any) => adminApi.flagRating(id, flagged),
    onSuccess: () => {
      toast({ title: "Avis mis à jour" });
      qc.invalidateQueries({ queryKey: ["admin-ratings"] });
      qc.invalidateQueries({ queryKey: ["admin-sidebar-badges"] });
    },
  });
  const del = useMutation({
    mutationFn: (id: number) => adminApi.deleteRating(id),
    onSuccess: () => {
      toast({ title: "Avis supprimé" });
      qc.invalidateQueries({ queryKey: ["admin-ratings"] });
      qc.invalidateQueries({ queryKey: ["admin-sidebar-badges"] });
    },
  });

  const reviewFlagged = useMutation({
    mutationFn: ({ id, decision, removeOffer }: any) => adminApi.reviewFlaggedOffer(id, { decision, removeOffer }),
    onSuccess: () => {
      toast({ title: "Signalement traité" });
      qc.invalidateQueries({ queryKey: ["admin-flagged-offers"] });
      qc.invalidateQueries({ queryKey: ["admin-sidebar-badges"] });
      setReviewFlag(null);
      setDecision("");
      setRemoveOffer(false);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "", variant: "destructive" }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-6">Avis & Modération</h1>

      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="avis" data-testid="tab-avis">⭐ Avis utilisateurs</TabsTrigger>
          <TabsTrigger value="offres" data-testid="tab-offres-signalees">
            🚩 Offres signalées
            {flagsData?.flags?.length ? (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">{flagsData.flags.length}</Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="avis" className="mt-4">
          <Card className="mb-4">
            <CardContent className="p-4 flex gap-3">
              <Select value={filters.filter ?? "all"} onValueChange={(v) => setFilters({ ...filters, filter: v === "all" ? undefined : v, page: 1 })}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Filtrer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les avis</SelectItem>
                  <SelectItem value="low">Note basse (≤ 2)</SelectItem>
                  <SelectItem value="flagged">Signalés</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
          ) : (
            <div className="grid gap-3">
              {data?.ratings.map((r: any) => (
                <Card key={r.id} data-testid={`row-rating-${r.id}`}>
                  <CardContent className="p-4 flex gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-4 w-4 ${i < r.stars ? "fill-amber-400 text-amber-400" : "text-muted"}`} />
                          ))}
                        </div>
                        {r.flagged && <Badge variant="destructive">Signalé</Badge>}
                        <span className="text-xs text-muted-foreground">
                          {r.reviewerName} → {r.revieweeName} · {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      {r.comment && <p className="text-sm">{r.comment}</p>}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" onClick={() => flag.mutate({ id: r.id, flagged: !r.flagged })}>
                        <Flag className="h-3 w-3 mr-1" />{r.flagged ? "Retirer" : "Signaler"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del.mutate(r.id)}>
                        <Trash2 className="h-3 w-3 mr-1" />Supprimer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {data?.ratings.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">Aucun avis</CardContent></Card>}
            </div>
          )}

          <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-muted-foreground">{data?.total ?? 0} avis</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Précédent</Button>
              <span className="text-sm px-3 py-1">{filters.page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={filters.page >= totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Suivant</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="offres" className="mt-4 space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> En attente de modération
            </h2>
            {flagsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>
            ) : flagsData?.flags?.length ? (
              <div className="grid gap-3">
                {flagsData.flags.map((f: any) => (
                  <Card key={f.id} className="border-l-4 border-l-destructive" data-testid={`row-flagged-offer-${f.id}`}>
                    <CardContent className="p-4 flex gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="destructive">{REASON_LABELS[f.reason] ?? f.reason}</Badge>
                          <Link href={`/offre/${f.offreId}`} className="text-sm font-semibold hover:underline inline-flex items-center gap-1" data-testid={`link-offre-${f.offreId}`}>
                            {f.offreTitre ?? `Offre #${f.offreId}`} <ExternalLink className="h-3 w-3" />
                          </Link>
                          {f.offreRegion && <span className="text-xs text-muted-foreground">· {f.offreRegion}</span>}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {f.createdAt ? new Date(f.createdAt).toLocaleString("fr-FR") : ""}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          Signalé par <strong>{f.reporterName ?? "Anonyme"}</strong> · Vendeur : <strong>{f.sellerName ?? "—"}</strong>
                        </div>
                        {f.comment && (
                          <div className="bg-muted/50 rounded-md p-2 text-sm">
                            <span className="text-xs font-semibold text-muted-foreground">Commentaire : </span>
                            {f.comment}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => { setReviewFlag(f); setDecision(""); setRemoveOffer(false); }}
                          data-testid={`button-review-flag-${f.id}`}
                        >
                          Examiner
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Aucun signalement en attente</CardContent></Card>
            )}
          </div>

          {flagsTreated?.flags?.length ? (
            <div>
              <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Récemment traités</h2>
              <div className="grid gap-2">
                {flagsTreated.flags.slice(0, 10).map((f: any) => (
                  <Card key={f.id} className="opacity-70">
                    <CardContent className="p-3 flex items-center gap-3 text-sm">
                      <Badge variant="outline">{REASON_LABELS[f.reason] ?? f.reason}</Badge>
                      <span className="font-medium truncate">{f.offreTitre}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {f.adminDecision ? `→ ${f.adminDecision}` : ""}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewFlag} onOpenChange={(o) => !o && setReviewFlag(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Examiner le signalement</DialogTitle></DialogHeader>
          {reviewFlag && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <div><strong>Offre :</strong> {reviewFlag.offreTitre}</div>
                <div><strong>Motif :</strong> {REASON_LABELS[reviewFlag.reason] ?? reviewFlag.reason}</div>
                <div><strong>Signalé par :</strong> {reviewFlag.reporterName}</div>
                {reviewFlag.comment && <div className="mt-2"><strong>Commentaire :</strong> {reviewFlag.comment}</div>}
              </div>
              <div>
                <Label htmlFor="decision">Décision / commentaire admin</Label>
                <Textarea
                  id="decision"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  placeholder="Ex: Signalement non fondé / Offre supprimée pour spam"
                  rows={3}
                  data-testid="textarea-decision"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="remove" checked={removeOffer} onCheckedChange={(c) => setRemoveOffer(!!c)} data-testid="checkbox-remove-offer" />
                <Label htmlFor="remove" className="text-sm cursor-pointer">Retirer l'offre du marché (statut "expiré")</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewFlag(null)}>Annuler</Button>
            <Button
              onClick={() => reviewFlag && reviewFlagged.mutate({ id: reviewFlag.id, decision, removeOffer })}
              disabled={!decision.trim() || reviewFlagged.isPending}
              data-testid="button-confirm-review"
            >
              {reviewFlagged.isPending && <Loader2 className="animate-spin h-3 w-3 mr-1" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
