import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, Users, TrendingUp, Search, Clock, CheckCircle2, XCircle, Loader2, AlertCircle,
  Eye, FileText, Image as ImageIcon, Download,
} from "lucide-react";
import {
  subscriptionsApi, PLAN_LABELS, PAYMENT_METHOD_LABELS,
} from "@/lib/subscriptions-api";

const FCFA = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

type Row = {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  user_role?: string;
  plan_name: string;
  plan_price_fcfa: number;
  status: string;
  started_at: string;
  expires_at: string;
  payment_method: string;
  payment_reference: string | null;
  has_payment_proof?: boolean;
  payment_proof_filename?: string | null;
  payment_proof_uploaded_at?: string | null;
  created_at: string;
};

type ProofData = {
  payment_proof_url: string;
  payment_proof_filename: string | null;
  payment_proof_uploaded_at: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-primary text-primary-foreground",
  en_attente_validation: "bg-amber-500 text-white",
  cancelled: "bg-muted text-foreground",
  expired: "bg-muted text-foreground",
  rejeté: "bg-destructive text-destructive-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  en_attente_validation: "À vérifier",
  cancelled: "Annulé",
  expired: "Expiré",
  rejeté: "Refusé",
};

export default function AdminAbonnementsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [confirmTarget, setConfirmTarget] = useState<Row | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Row | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [proofTarget, setProofTarget] = useState<Row | null>(null);
  const [proofData, setProofData] = useState<ProofData | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const proofRequestIdRef = useRef(0);

  const openProof = async (row: Row) => {
    const reqId = ++proofRequestIdRef.current;
    setProofTarget(row);
    setProofData(null);
    setProofError(null);
    setProofLoading(true);
    try {
      const res = await subscriptionsApi.adminViewProof(row.id);
      if (proofRequestIdRef.current !== reqId) return;
      setProofData(res);
    } catch (e: any) {
      if (proofRequestIdRef.current !== reqId) return;
      setProofError(e?.message ?? "Impossible de charger la preuve");
    } finally {
      if (proofRequestIdRef.current === reqId) setProofLoading(false);
    }
  };

  const closeProof = () => {
    proofRequestIdRef.current++;
    setProofTarget(null);
    setProofData(null);
    setProofError(null);
    setProofLoading(false);
  };

  const isPdfProof = (data: ProofData) => data.payment_proof_url.startsWith("data:application/pdf");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-subscriptions", statusFilter, planFilter],
    queryFn: () => subscriptionsApi.adminList({
      status: statusFilter === "all" ? undefined : statusFilter,
      plan: planFilter === "all" ? undefined : planFilter,
    }),
  });

  // Always-on pending list (independent of filters), so admins never miss requests.
  const { data: pendingData } = useQuery({
    queryKey: ["admin-subscriptions", "pending-only"],
    queryFn: () => subscriptionsApi.adminList({ status: "en_attente_validation" }),
    refetchInterval: 30_000,
  });

  const pendingRows = useMemo<Row[]>(
    () => (pendingData?.subscriptions ?? []) as Row[],
    [pendingData],
  );

  const confirmMut = useMutation({
    mutationFn: (id: number) => subscriptionsApi.adminConfirmSubscription(id),
    onSuccess: () => {
      toast({ title: "Abonnement activé", description: "Le transformateur a été notifié." });
      qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      setConfirmTarget(null);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Échec de l'activation", variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      subscriptionsApi.adminRejectSubscription(id, reason),
    onSuccess: () => {
      toast({ title: "Demande refusée", description: "Le transformateur a été notifié." });
      qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Échec du refus", variant: "destructive" }),
  });

  const formatAge = (iso: string) => {
    const ms = Date.now() - new Date(iso).getTime();
    const h = Math.floor(ms / 3_600_000);
    if (h < 1) return "il y a quelques minutes";
    if (h < 24) return `il y a ${h} h`;
    const d = Math.floor(h / 24);
    return `il y a ${d} j`;
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-subscriptions">
        <div>
          <h1 className="text-2xl font-bold">Abonnements</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestion des abonnements transformateurs.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-none shadow-sm ring-1 ring-amber-200 bg-amber-50/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Paiements à vérifier</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-12" /> : (
                <div className="text-3xl font-bold text-amber-700" data-testid="stat-total-pending">
                  {data?.stats.total_pending ?? 0}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm ring-1 ring-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Abonnés actifs</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold" data-testid="stat-total-active">
                  {data?.stats.total_active ?? 0}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm ring-1 ring-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Revenus totaux</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-32" /> : (
                <div className="text-3xl font-bold" data-testid="stat-total-revenue">
                  {FCFA(data?.stats.total_revenue_fcfa ?? 0)} FCFA
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* PENDING SECTION — always visible at top */}
        <Card
          className="border-none shadow-sm ring-2 ring-amber-300 bg-amber-50/30"
          data-testid="pending-review-section"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-900">
              <Clock className="h-5 w-5" />
              Paiements à vérifier
              {pendingRows.length > 0 && (
                <Badge className="bg-amber-500 text-white ml-1">{pendingRows.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingRows.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-primary/40" />
                Aucune demande en attente.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-2">Transformateur</th>
                      <th className="py-2 pr-2">Plan demandé</th>
                      <th className="py-2 pr-2">Paiement</th>
                      <th className="py-2 pr-2">Preuve</th>
                      <th className="py-2 pr-2">Reçu</th>
                      <th className="py-2 pr-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRows.map((s) => (
                      <tr key={s.id} className="border-b hover:bg-amber-100/40" data-testid={`row-pending-${s.id}`}>
                        <td className="py-3 pr-2">
                          <Link href={`/profil/${s.user_id}`} className="hover:underline">
                            <div className="font-medium">{s.user_name}</div>
                            <div className="text-xs text-muted-foreground">{s.user_email}</div>
                          </Link>
                        </td>
                        <td className="py-3 pr-2">
                          <Badge variant="outline">{PLAN_LABELS[s.plan_name] ?? s.plan_name}</Badge>
                          <div className="text-xs text-muted-foreground mt-1 font-medium">
                            {FCFA(s.plan_price_fcfa)} FCFA
                          </div>
                        </td>
                        <td className="py-3 pr-2 text-xs">
                          <div>{PAYMENT_METHOD_LABELS[s.payment_method] ?? s.payment_method}</div>
                          {s.payment_reference ? (
                            <div className="font-mono text-muted-foreground">{s.payment_reference}</div>
                          ) : (
                            <div className="text-amber-700 italic">Sans référence</div>
                          )}
                        </td>
                        <td className="py-3 pr-2 text-xs">
                          {s.has_payment_proof ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openProof(s)}
                              data-testid={`btn-view-proof-${s.id}`}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Voir la preuve
                            </Button>
                          ) : (
                            <span className="text-amber-700 italic">Aucune</span>
                          )}
                        </td>
                        <td className="py-3 pr-2 text-xs text-muted-foreground">
                          {formatAge(s.created_at)}
                        </td>
                        <td className="py-3 pr-2">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive/40 hover:bg-destructive/10"
                              onClick={() => { setRejectTarget(s); setRejectReason(""); }}
                              data-testid={`btn-reject-${s.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Refuser
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setConfirmTarget(s)}
                              data-testid={`btn-confirm-${s.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Confirmer
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm ring-1 ring-border/50">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4 text-primary" />
                Liste des abonnements
              </CardTitle>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]" data-testid="filter-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    <SelectItem value="en_attente_validation">À vérifier</SelectItem>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="expired">Expiré</SelectItem>
                    <SelectItem value="cancelled">Annulé</SelectItem>
                    <SelectItem value="rejeté">Refusé</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="filter-plan"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous plans</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !data?.subscriptions.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Aucun abonnement trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-2">Utilisateur</th>
                      <th className="py-2 pr-2">Plan</th>
                      <th className="py-2 pr-2">Statut</th>
                      <th className="py-2 pr-2">Période</th>
                      <th className="py-2 pr-2">Paiement</th>
                      <th className="py-2 pr-2">Preuve</th>
                      <th className="py-2 pr-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.subscriptions as Row[]).map((s) => (
                      <tr key={s.id} className="border-b hover:bg-muted/30" data-testid={`row-sub-${s.id}`}>
                        <td className="py-3 pr-2">
                          <Link href={`/profil/${s.user_id}`} className="hover:underline">
                            <div className="font-medium">{s.user_name}</div>
                            <div className="text-xs text-muted-foreground">{s.user_email}</div>
                          </Link>
                        </td>
                        <td className="py-3 pr-2">
                          <Badge variant="outline">{PLAN_LABELS[s.plan_name] ?? s.plan_name}</Badge>
                          <div className="text-xs text-muted-foreground mt-1">{FCFA(s.plan_price_fcfa)} FCFA</div>
                        </td>
                        <td className="py-3 pr-2">
                          <Badge className={STATUS_BADGE[s.status] ?? "bg-muted text-foreground"}>
                            {STATUS_LABEL[s.status] ?? s.status}
                          </Badge>
                        </td>
                        <td className="py-3 pr-2 text-xs">
                          <div>Du {new Date(s.started_at).toLocaleDateString("fr-FR")}</div>
                          <div>au {new Date(s.expires_at).toLocaleDateString("fr-FR")}</div>
                        </td>
                        <td className="py-3 pr-2 text-xs">
                          <div>{PAYMENT_METHOD_LABELS[s.payment_method] ?? s.payment_method}</div>
                          {s.payment_reference && <div className="font-mono text-muted-foreground">{s.payment_reference}</div>}
                        </td>
                        <td className="py-3 pr-2 text-xs">
                          {s.has_payment_proof ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openProof(s)}
                              data-testid={`btn-list-view-proof-${s.id}`}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Voir
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-2 text-right">
                          {s.status === "en_attente_validation" ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive/40 hover:bg-destructive/10"
                                onClick={() => { setRejectTarget(s); setRejectReason(""); }}
                                data-testid={`btn-list-reject-${s.id}`}
                              >
                                Refuser
                              </Button>
                              <Button size="sm" onClick={() => setConfirmTarget(s)} data-testid={`btn-list-confirm-${s.id}`}>
                                Confirmer
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CONFIRM DIALOG */}
      <Dialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <DialogContent data-testid="confirm-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Confirmer le paiement
            </DialogTitle>
            <DialogDescription>
              Activez l'abonnement après avoir vérifié la réception du paiement sur votre compte.
            </DialogDescription>
          </DialogHeader>
          {confirmTarget && (
            <div className="space-y-3 py-2 text-sm">
              <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Transformateur</span><strong>{confirmTarget.user_name}</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><strong>{PLAN_LABELS[confirmTarget.plan_name] ?? confirmTarget.plan_name}</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Montant</span><strong>{FCFA(confirmTarget.plan_price_fcfa)} FCFA</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Mode</span><strong>{PAYMENT_METHOD_LABELS[confirmTarget.payment_method] ?? confirmTarget.payment_method}</strong></div>
                {confirmTarget.payment_reference && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Référence</span><strong className="font-mono text-xs">{confirmTarget.payment_reference}</strong></div>
                )}
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex gap-2 text-xs text-amber-900">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <span>L'abonnement débutera maintenant pour 30 jours et la facture sera marquée payée. Cette action est consignée.</span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmTarget(null)}>Annuler</Button>
            <Button
              onClick={() => confirmTarget && confirmMut.mutate(confirmTarget.id)}
              disabled={confirmMut.isPending}
              data-testid="btn-confirm-action"
            >
              {confirmMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Activer l'abonnement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECT DIALOG */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent data-testid="reject-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Refuser la demande
            </DialogTitle>
            <DialogDescription>
              Indiquez le motif du refus. Le transformateur sera notifié et pourra refaire une demande.
            </DialogDescription>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-3 py-2 text-sm">
              <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Transformateur</span><strong>{rejectTarget.user_name}</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Plan demandé</span><strong>{PLAN_LABELS[rejectTarget.plan_name] ?? rejectTarget.plan_name}</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Référence</span><strong className="font-mono text-xs">{rejectTarget.payment_reference ?? "—"}</strong></div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Motif du refus</label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ex : Aucun paiement reçu sur le compte indiqué."
                  rows={3}
                  data-testid="input-reject-reason"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => rejectTarget && rejectMut.mutate({ id: rejectTarget.id, reason: rejectReason.trim() })}
              disabled={rejectMut.isPending || !rejectReason.trim()}
              data-testid="btn-reject-action"
            >
              {rejectMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Refuser la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PROOF VIEWER DIALOG */}
      <Dialog open={!!proofTarget} onOpenChange={(o) => { if (!o) closeProof(); }}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" data-testid="proof-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {proofData && isPdfProof(proofData) ? (
                <FileText className="h-5 w-5 text-primary" />
              ) : (
                <ImageIcon className="h-5 w-5 text-primary" />
              )}
              Preuve de paiement
            </DialogTitle>
            <DialogDescription>
              {proofTarget && (
                <>
                  {proofTarget.user_name} — {PLAN_LABELS[proofTarget.plan_name] ?? proofTarget.plan_name} ·{" "}
                  {FCFA(proofTarget.plan_price_fcfa)} FCFA ·{" "}
                  {PAYMENT_METHOD_LABELS[proofTarget.payment_method] ?? proofTarget.payment_method}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {proofLoading && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Chargement de la preuve...
              </div>
            )}

            {proofError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {proofError}
              </div>
            )}

            {proofData && !proofError && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div>
                    {proofData.payment_proof_filename && (
                      <span className="font-mono">{proofData.payment_proof_filename}</span>
                    )}
                    {proofData.payment_proof_uploaded_at && (
                      <span className="ml-2">
                        envoyée le{" "}
                        {new Date(proofData.payment_proof_uploaded_at).toLocaleString("fr-FR")}
                      </span>
                    )}
                  </div>
                  <a
                    href={proofData.payment_proof_url}
                    download={proofData.payment_proof_filename ?? `preuve-${proofTarget?.id}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    data-testid="btn-download-proof"
                  >
                    <Download className="h-3 w-3" /> Télécharger
                  </a>
                </div>

                <div className="rounded-md border bg-muted/20 p-2 flex items-center justify-center min-h-[400px]">
                  {isPdfProof(proofData) ? (
                    <iframe
                      src={proofData.payment_proof_url}
                      title="Preuve de paiement (PDF)"
                      className="w-full h-[70vh] border-0 rounded"
                      data-testid="proof-pdf-viewer"
                    />
                  ) : (
                    <img
                      src={proofData.payment_proof_url}
                      alt="Preuve de paiement"
                      className="max-w-full max-h-[70vh] object-contain rounded"
                      data-testid="proof-image-viewer"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeProof}>Fermer</Button>
            {proofTarget?.status === "en_attente_validation" && (
              <>
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  onClick={() => { const t = proofTarget; closeProof(); setRejectTarget(t); setRejectReason(""); }}
                  data-testid="btn-proof-reject"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Refuser
                </Button>
                <Button
                  onClick={() => { const t = proofTarget; closeProof(); setConfirmTarget(t); }}
                  data-testid="btn-proof-confirm"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Confirmer le paiement
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
