import { Link, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, MapPin, FileText, Download, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { ordersApi, formatFcfa, orderStatusLabel, orderItemStatusLabel, type OrderDetail } from "@/lib/orders-api";
import { VerificationBadge } from "@/components/verification-badge";

type OrderDetailItem = OrderDetail["items"][number];

export default function CommandeDetailPage() {
  const [, params] = useRoute("/commandes/:id");
  const id = Number(params?.id);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["orders", "detail", id],
    queryFn: () => ordersApi.detail(id),
    enabled: Number.isFinite(id),
  });

  const counterMut = useMutation({
    mutationFn: ({ itemId, action }: { itemId: number; action: "accepter" | "refuser" }) =>
      ordersApi.counterRespond(itemId, { action }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders", "detail", id] });
      toast({ title: vars.action === "accepter" ? "✓ Contre-proposition acceptée" : "Contre-proposition refusée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Action impossible", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="container py-10 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="container py-10 max-w-xl">
        <Card className="border-dashed bg-red-50 border-red-200">
          <CardContent className="p-8 text-center">
            <XCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h2 className="font-semibold text-lg">Impossible de charger la commande</h2>
            <p className="text-sm text-muted-foreground mt-1">{(error as any)?.message ?? "La commande est peut-être introuvable ou vous n'y avez pas accès."}</p>
            <div className="flex gap-2 justify-center mt-4">
              <Button variant="outline" onClick={() => refetch()}>Réessayer</Button>
              <Link href="/commandes"><Button>Mes commandes</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = orderStatusLabel(order.status);
  const totalItems = order.items.length;
  const responded = (order.items as OrderDetailItem[]).filter((i) => i.status !== "en_attente").length;
  const progress = totalItems > 0 ? Math.round((responded / totalItems) * 100) : 0;

  // Group items by seller for readability
  const groups = new Map<number, OrderDetailItem[]>();
  for (const item of (order.items as OrderDetailItem[])) {
    const arr = groups.get(item.producteur_id) ?? [];
    arr.push(item);
    groups.set(item.producteur_id, arr);
  }

  return (
    <div className="container py-6 md:py-10 max-w-5xl">
      <div className="mb-4">
        <Link href="/commandes">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Mes commandes
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs text-muted-foreground">Référence</div>
              <div className="font-mono font-semibold text-lg" data-testid="text-order-ref">{order.reference}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Passée le {new Date(order.created_at).toLocaleDateString("fr-FR")} à {new Date(order.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div className="text-right">
              <Badge className={statusInfo.color + " text-sm"}>{statusInfo.emoji} {statusInfo.label}</Badge>
              <div className="mt-2">
                <div className="text-xs text-muted-foreground">Total estimé</div>
                <div className="font-bold text-xl tabular-nums">{formatFcfa(order.total_fcfa)} FCFA</div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Réponses des vendeurs</span>
            <span className="font-medium">{responded}/{totalItems} vendeur{totalItems > 1 ? "s" : ""}</span>
          </div>
          <Progress value={progress} />
          {order.note_globale && (
            <div className="mt-4 text-sm bg-muted/40 rounded p-3">
              <div className="text-xs text-muted-foreground mb-1">Note globale</div>
              <p className="italic">"{order.note_globale}"</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {Array.from(groups.entries()).map(([sellerId, items]) => {
          const seller = items[0].producteur;
          return (
            <Card key={sellerId} data-testid={`order-group-${sellerId}`}>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                    {seller?.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{seller?.name ?? "—"}</span>
                      {seller && <VerificationBadge level={seller.verificationLevel} size="sm" />}
                    </div>
                    {seller?.region && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {seller.region}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {items.map((item: OrderDetailItem) => {
                  const si = orderItemStatusLabel(item.status);
                  return (
                    <div key={item.id} className="rounded-lg border p-3" data-testid={`order-item-${item.id}`}>
                      <div className="flex items-start gap-3">
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{item.offer.type_residu}</span>
                            <Badge className={si.color}>{si.emoji} {si.label}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="tabular-nums">{formatFcfa(item.quantity_kg)}kg</span> × <span className="tabular-nums">{formatFcfa(item.unit_price_fcfa)} FCFA/kg</span>
                          </div>
                        </div>
                        <div className="text-right tabular-nums">
                          <div className="font-semibold">{formatFcfa(item.total_fcfa)} FCFA</div>
                        </div>
                      </div>

                      {item.status === "contre_proposée" && item.counter_quantity_kg != null && item.counter_price_fcfa != null && (
                        <div className="mt-3 border-l-4 border-blue-500 bg-blue-50 rounded-r p-3 space-y-2" data-testid={`counter-proposal-${item.id}`}>
                          <div className="font-semibold text-sm text-blue-900">Contre-proposition de {seller?.name}</div>
                          <div className="text-sm grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-xs text-muted-foreground">Quantité proposée</div>
                              <div className="tabular-nums font-medium">
                                {formatFcfa(item.counter_quantity_kg)}kg <span className="text-xs text-muted-foreground">(vs {formatFcfa(item.quantity_kg)}kg demandé)</span>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Prix proposé</div>
                              <div className="tabular-nums font-medium">
                                {formatFcfa(item.counter_price_fcfa)} FCFA/kg <span className="text-xs text-muted-foreground">(vs {formatFcfa(item.unit_price_fcfa)})</span>
                              </div>
                            </div>
                          </div>
                          {item.counter_note && (
                            <div className="text-sm text-blue-900 italic">"{item.counter_note}"</div>
                          )}
                          <div className="text-sm">
                            <span className="text-muted-foreground">Nouveau total : </span>
                            <span className="font-bold tabular-nums">{formatFcfa(item.counter_quantity_kg * item.counter_price_fcfa)} FCFA</span>
                          </div>
                          <div className="flex gap-2 flex-wrap pt-1">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" data-testid={`button-accept-counter-${item.id}`}>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Accepter la contre-proposition
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Accepter la contre-proposition ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Un contrat sera généré automatiquement pour {formatFcfa(item.counter_quantity_kg!)}kg à {formatFcfa(item.counter_price_fcfa!)} FCFA/kg.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => counterMut.mutate({ itemId: item.id, action: "accepter" })}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                  >
                                    Confirmer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => counterMut.mutate({ itemId: item.id, action: "refuser" })} data-testid={`button-refuse-counter-${item.id}`}>
                              <XCircle className="h-4 w-4 mr-2" />
                              Refuser
                            </Button>
                          </div>
                        </div>
                      )}

                      {item.status === "acceptée" && (
                        <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded p-3 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 text-emerald-800 text-sm">
                            <CheckCircle2 className="h-4 w-4" />
                            Commande acceptée · Contrat généré
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="gap-1">
                              <FileText className="h-3.5 w-3.5" /> Voir le contrat
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1">
                              <Download className="h-3.5 w-3.5" /> PDF
                            </Button>
                          </div>
                        </div>
                      )}

                      {item.status === "refusée" && item.counter_note && (
                        <div className="mt-3 bg-red-50 border border-red-200 rounded p-2 text-sm text-red-900">
                          <strong>Motif du refus :</strong> {item.counter_note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
