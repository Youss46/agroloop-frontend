import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@/api-client";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, BadgeCheck, X, FileText, Eye, Loader2 } from "lucide-react";

const DOC_LABELS: Record<string, string> = {
  cni: "CNI",
  passeport: "Passeport",
  carte_cooperative: "Carte coopérative",
  photo_parcelle: "Photo parcelle",
  rccm: "RCCM",
  attestation_fiscale: "Attestation fiscale",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  en_attente: { label: "En attente", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  "approuvée": { label: "Approuvée", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  "rejetée": { label: "Refusée", cls: "bg-red-100 text-red-800 border-red-300" },
};

export default function AdminVerifications() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("en_attente");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectMode, setRejectMode] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);

  const params = new URLSearchParams();
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (levelFilter !== "all") params.set("level", levelFilter);

  const list = useQuery({
    queryKey: ["admin-verifications", statusFilter, levelFilter],
    queryFn: () =>
      customFetch<any>(`/api/admin/verifications${params.toString() ? `?${params.toString()}` : ""}`),
  });

  const detail = useQuery({
    queryKey: ["admin-verifications", "detail", selectedId],
    queryFn: () => customFetch<any>(`/api/admin/verifications/${selectedId}`),
    enabled: !!selectedId,
  });

  const approve = useMutation({
    mutationFn: ({ id, level }: { id: number; level: string }) =>
      customFetch(`/api/admin/verifications/${id}/approve`, {
        method: "PUT",
        body: JSON.stringify({ level }),
      }),
    onSuccess: () => {
      toast({ title: "Demande approuvée" });
      qc.invalidateQueries({ queryKey: ["admin-verifications"] });
      setSelectedId(null);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message || "Échec", variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      customFetch(`/api/admin/verifications/${id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      toast({ title: "Demande refusée" });
      qc.invalidateQueries({ queryKey: ["admin-verifications"] });
      setSelectedId(null);
      setRejectMode(false);
      setRejectReason("");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message || "Échec", variant: "destructive" }),
  });

  return (
    <AdminLayout>
      <div className="space-y-4" data-testid="admin-verifications">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Vérifications</h1>
            <p className="text-sm text-muted-foreground">
              {list.data ? `${list.data.pendingCount} en attente — ${list.data.total} au total` : "—"}
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="filter-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="en_attente">En attente</SelectItem>
                <SelectItem value="approuvée">Approuvées</SelectItem>
                <SelectItem value="rejetée">Refusées</SelectItem>
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[160px]" data-testid="filter-level"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous niveaux</SelectItem>
                <SelectItem value="identite">Identité</SelectItem>
                <SelectItem value="professionnel">Professionnel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {list.isLoading && <div className="p-6 text-center"><Loader2 className="animate-spin inline" /></div>}
            {list.data && list.data.items.length === 0 && (
              <div className="p-6 text-center text-muted-foreground">Aucune demande</div>
            )}
            {list.data && list.data.items.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Utilisateur</th>
                    <th className="p-3">Niveau</th>
                    <th className="p-3">Docs</th>
                    <th className="p-3">Statut</th>
                    <th className="p-3">Date</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((it: any) => (
                    <tr key={it.id} className="border-t" data-testid={`verif-row-${it.id}`}>
                      <td className="p-3">
                        <div className="font-medium">{it.userName}</div>
                        <div className="text-xs text-muted-foreground">{it.userEmail} · {it.userRole}</div>
                      </td>
                      <td className="p-3">
                        {it.level === "professionnel"
                          ? <span className="inline-flex items-center gap-1 text-emerald-700"><BadgeCheck size={14}/>Pro</span>
                          : <span className="inline-flex items-center gap-1 text-blue-700"><ShieldCheck size={14}/>Identité</span>}
                      </td>
                      <td className="p-3">{it.documentCount}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={STATUS_BADGE[it.status]?.cls}>
                          {STATUS_BADGE[it.status]?.label ?? it.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(it.createdAt).toLocaleString("fr-FR")}
                      </td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelectedId(it.id)} data-testid={`button-review-${it.id}`}>
                          <Eye size={14} className="mr-1"/>Examiner
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedId} onOpenChange={(o) => { if (!o) { setSelectedId(null); setRejectMode(false); setRejectReason(""); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Demande de vérification</DialogTitle>
          </DialogHeader>
          {detail.isLoading && <div className="text-center py-6"><Loader2 className="animate-spin inline"/></div>}
          {detail.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Utilisateur</div>
                  <div className="font-medium">{detail.data.user?.name}</div>
                  <div className="text-xs">{detail.data.user?.email} · {detail.data.user?.role}</div>
                  <div className="text-xs text-muted-foreground">{detail.data.user?.region ?? "—"} · {detail.data.user?.phone ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Niveau demandé</div>
                  <div className="font-medium capitalize">{detail.data.request.level}</div>
                  <div className="text-muted-foreground mt-2">Statut</div>
                  <Badge variant="outline" className={STATUS_BADGE[detail.data.request.status]?.cls}>
                    {STATUS_BADGE[detail.data.request.status]?.label}
                  </Badge>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Documents ({detail.data.documents.length})</div>
                <ul className="space-y-2">
                  {detail.data.documents.map((d: any) => (
                    <li key={d.id} className="flex items-center justify-between border rounded p-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={16} className="text-emerald-700 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{DOC_LABELS[d.documentType] ?? d.documentType}</div>
                          <div className="text-xs text-muted-foreground truncate">{d.fileName}</div>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setPreviewDoc(d)} data-testid={`button-preview-doc-${d.id}`}>
                        <Eye size={14} className="mr-1" />Aperçu
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>

              {detail.data.request.status === "en_attente" && (
                <>
                  {!rejectMode && (
                    <div className="flex gap-2 justify-end pt-2 border-t">
                      <Button variant="outline" className="text-red-700" onClick={() => setRejectMode(true)} data-testid="button-open-reject">
                        <X size={14} className="mr-1"/>Refuser
                      </Button>
                      <Button
                        className="bg-blue-700 hover:bg-blue-800"
                        onClick={() => approve.mutate({ id: selectedId!, level: "identite" })}
                        disabled={approve.isPending}
                        data-testid="button-approve-identity"
                      >
                        <ShieldCheck size={14} className="mr-1"/>Approuver Identité
                      </Button>
                      <Button
                        className="bg-emerald-700 hover:bg-emerald-800"
                        onClick={() => approve.mutate({ id: selectedId!, level: "professionnel" })}
                        disabled={approve.isPending || detail.data.request.level !== "professionnel"}
                        data-testid="button-approve-pro"
                      >
                        <BadgeCheck size={14} className="mr-1"/>Approuver Pro
                      </Button>
                    </div>
                  )}
                  {rejectMode && (
                    <div className="space-y-2 pt-2 border-t">
                      <label className="text-sm font-medium">Motif du refus</label>
                      <Textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Expliquez la raison du refus (visible par l'utilisateur)"
                        data-testid="textarea-reject-reason"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => { setRejectMode(false); setRejectReason(""); }}>Annuler</Button>
                        <Button
                          className="bg-red-700 hover:bg-red-800"
                          onClick={() => reject.mutate({ id: selectedId!, reason: rejectReason })}
                          disabled={reject.isPending || rejectReason.trim().length < 5}
                          data-testid="button-confirm-reject"
                        >
                          Confirmer le refus
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {detail.data.request.rejectionReason && (
                <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  Motif du refus précédent : {detail.data.request.rejectionReason}
                </div>
              )}
            </div>
          )}
          <DialogFooter />
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewDoc} onOpenChange={(o) => { if (!o) setPreviewDoc(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewDoc?.fileName}</DialogTitle>
          </DialogHeader>
          {previewDoc && previewDoc.fileUrl?.startsWith("data:image") && (
            <img src={previewDoc.fileUrl} alt={previewDoc.fileName} className="max-h-[70vh] mx-auto" loading="lazy" />
          )}
          {previewDoc && previewDoc.fileUrl?.startsWith("data:application/pdf") && (
            <iframe src={previewDoc.fileUrl} className="w-full h-[70vh]" title="PDF" />
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
