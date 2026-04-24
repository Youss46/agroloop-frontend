import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Send, Lock, FileText, AlertTriangle, Shield, Trash2, GitMerge,
  CheckCircle2, X, Loader2,
} from "lucide-react";
import {
  supportApi, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS,
  type TicketStatus, type TicketPriority,
} from "@/lib/support-tickets-api";
import { useAuth } from "@/components/auth-provider";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminSupportDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [mergeId, setMergeId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-ticket", id],
    queryFn: () => supportApi.getTicket(id),
    enabled: !isNaN(id),
  });

  const { data: tplData } = useQuery({ queryKey: ["support-templates"], queryFn: () => supportApi.listTemplates() });
  const { data: cats } = useQuery({ queryKey: ["support-cats-admin"], queryFn: () => supportApi.listCategoriesAdmin() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-ticket", id] });
    qc.invalidateQueries({ queryKey: ["support-tickets"] });
    qc.invalidateQueries({ queryKey: ["support-stats"] });
  };

  const replyMut = useMutation({
    mutationFn: (vars: { msg: string; internal: boolean; tplId?: number }) =>
      supportApi.reply(id, vars.msg, vars.internal, vars.tplId),
    onSuccess: () => {
      setReply(""); setIsInternal(false);
      invalidate();
      toast({ title: "Réponse envoyée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const statusMut = useMutation({
    mutationFn: (s: TicketStatus) => supportApi.setStatus(id, s),
    onSuccess: (_, s) => { invalidate(); toast({ title: `Ticket → ${STATUS_LABELS[s]}` }); },
    onError: (e: any) => toast({ title: "Erreur", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const priorityMut = useMutation({
    mutationFn: (p: TicketPriority) => supportApi.setPriority(id, p),
    onSuccess: () => { invalidate(); toast({ title: "Priorité mise à jour" }); },
  });

  const assignMut = useMutation({
    mutationFn: (adminId: number | null) => supportApi.assign(id, adminId),
    onSuccess: () => { invalidate(); toast({ title: "Assignation mise à jour" }); },
  });

  const mergeMut = useMutation({
    mutationFn: (target: number) => supportApi.merge(id, target),
    onSuccess: () => {
      invalidate(); toast({ title: "Tickets fusionnés" });
      setShowMerge(false); setLocation("/admin/support");
    },
    onError: (e: any) => toast({ title: "Erreur", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: () => supportApi.remove(id),
    onSuccess: () => { toast({ title: "Ticket supprimé" }); setLocation("/admin/support"); },
  });

  const applyTemplate = (tplId: string) => {
    const tpl = tplData?.items.find((t: any) => String(t.id) === tplId);
    if (tpl) setReply(tpl.content);
  };

  if (isLoading) return <AdminLayout><Skeleton className="h-96 w-full" /></AdminLayout>;
  if (!data) return <AdminLayout><div className="p-6">Ticket introuvable.</div></AdminLayout>;

  const { ticket, replies, history } = data;
  const cat = ticket.category_obj;

  return (
    <AdminLayout>
      <div className="space-y-4 max-w-6xl" data-testid="admin-ticket-detail">
        <div className="flex items-center gap-2">
          <Link href="/admin/support">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Retour</Button>
          </Link>
          <span className="font-mono text-sm text-muted-foreground">{ticket.reference}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <CardTitle className="text-xl">{ticket.sujet}</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <Badge className={STATUS_COLORS[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
                    <Badge className={PRIORITY_COLORS[ticket.priority]}>{PRIORITY_LABELS[ticket.priority]}</Badge>
                    {ticket.sla_status === "breached" && (
                      <Badge className="bg-red-100 text-red-700 gap-1">
                        <AlertTriangle className="h-3 w-3" />SLA dépassé
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/40 rounded-lg p-4 whitespace-pre-wrap">
                  {ticket.message}
                </div>
                <div className="text-xs text-muted-foreground">
                  Créé {formatDate(ticket.created_at)} par {ticket.user?.name ?? "?"}
                </div>
              </CardContent>
            </Card>

            {/* Replies thread */}
            <Card>
              <CardHeader><CardTitle className="text-base">💬 Conversation ({replies.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {replies.length === 0 && <div className="text-sm text-muted-foreground">Aucune réponse.</div>}
                {replies.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-lg p-3 border ${
                      r.is_internal_note
                        ? "bg-yellow-50 border-yellow-200"
                        : r.sender?.role === "admin"
                          ? "bg-blue-50 border-blue-100"
                          : "bg-white"
                    }`}
                    data-testid={`reply-${r.id}`}
                  >
                    <div className="flex items-center justify-between mb-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{r.sender?.name ?? "?"}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {r.sender?.role === "admin" ? "Support" : "Utilisateur"}
                        </Badge>
                        {r.is_internal_note && (
                          <Badge className="bg-yellow-100 text-yellow-700 text-[10px] gap-0.5">
                            <Lock className="h-2.5 w-2.5" />Note interne
                          </Badge>
                        )}
                        {r.is_template_reply && (
                          <Badge variant="outline" className="text-[10px] gap-0.5">
                            <FileText className="h-2.5 w-2.5" />Modèle
                          </Badge>
                        )}
                      </div>
                      <span className="text-muted-foreground">{formatDate(r.created_at)}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm">{r.message}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Reply box */}
            {!["ferme", "spam", "doublon"].includes(ticket.status) && (
              <Card>
                <CardHeader><CardTitle className="text-base">✍️ Répondre</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {(tplData?.items ?? []).length > 0 && (
                    <Select onValueChange={applyTemplate}>
                      <SelectTrigger className="w-full" data-testid="select-template">
                        <SelectValue placeholder="📋 Insérer un modèle de réponse…" />
                      </SelectTrigger>
                      <SelectContent>
                        {tplData!.items.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Textarea
                    placeholder={isInternal ? "Note interne (visible par les admins seulement)…" : "Votre réponse à l'utilisateur…"}
                    rows={5}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    className={isInternal ? "bg-yellow-50" : ""}
                    data-testid="textarea-reply"
                  />
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        data-testid="checkbox-internal"
                      />
                      <Lock className="h-3 w-3" />Note interne
                    </label>
                    <Button
                      onClick={() => reply.trim() && replyMut.mutate({ msg: reply.trim(), internal: isInternal })}
                      disabled={!reply.trim() || replyMut.isPending}
                      data-testid="btn-send-reply"
                    >
                      {replyMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                      Envoyer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* History */}
            {history.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">🕐 Historique</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-xs">
                  {history.map((h) => (
                    <div key={h.id} className="flex gap-2 text-muted-foreground">
                      <span className="text-[10px] w-32 shrink-0">{formatDate(h.created_at)}</span>
                      <span><b>{h.actor_name}</b> · {h.action}{h.from_value && h.to_value ? `: ${h.from_value} → ${h.to_value}` : ""}{h.note ? ` (${h.note})` : ""}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">⚙️ Actions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Statut</label>
                  <Select value={ticket.status} onValueChange={(v) => statusMut.mutate(v as TicketStatus)}>
                    <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ouvert">🔴 Ouvert</SelectItem>
                      <SelectItem value="en_cours">🟡 En cours</SelectItem>
                      <SelectItem value="resolu">🟢 Résolu</SelectItem>
                      <SelectItem value="ferme">⚫ Fermé</SelectItem>
                      <SelectItem value="spam">🚫 Spam</SelectItem>
                      <SelectItem value="doublon">🔁 Doublon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Priorité</label>
                  <Select value={ticket.priority} onValueChange={(v) => priorityMut.mutate(v as TicketPriority)}>
                    <SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normale">⚪ Normale</SelectItem>
                      <SelectItem value="haute">🟠 Haute</SelectItem>
                      <SelectItem value="urgente">🔴 Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Assigné à</label>
                  <div className="flex gap-2">
                    <div className="flex-1 text-sm py-2 px-3 bg-muted rounded">
                      {ticket.assignee?.name ?? "Personne"}
                    </div>
                    {ticket.assigned_to !== user?.id ? (
                      <Button size="sm" variant="outline" onClick={() => assignMut.mutate(user?.id ?? null)} data-testid="btn-claim">
                        Me l'attribuer
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => assignMut.mutate(null)} data-testid="btn-unassign">
                        Libérer
                      </Button>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t flex flex-col gap-2">
                  <Dialog open={showMerge} onOpenChange={setShowMerge}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start" data-testid="btn-merge">
                        <GitMerge className="h-4 w-4 mr-2" />Fusionner dans…
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Fusionner ce ticket</DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-muted-foreground">
                        Saisissez l'ID du ticket cible. Ce ticket sera marqué « doublon » et toutes ses réponses migrées.
                      </p>
                      <input
                        className="border rounded px-3 py-2"
                        placeholder="ID du ticket cible"
                        value={mergeId}
                        onChange={(e) => setMergeId(e.target.value)}
                        data-testid="input-merge-target"
                      />
                      <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowMerge(false)}>Annuler</Button>
                        <Button
                          onClick={() => mergeId && mergeMut.mutate(Number(mergeId))}
                          disabled={!mergeId || mergeMut.isPending}
                        >
                          Fusionner
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-red-600 hover:text-red-700"
                    onClick={() => {
                      if (confirm("Supprimer définitivement ce ticket et son historique ?")) deleteMut.mutate();
                    }}
                    data-testid="btn-delete"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />Supprimer
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">👤 Utilisateur</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <div><b>Nom :</b> {ticket.user?.name ?? "—"}</div>
                <div><b>Email :</b> {ticket.user?.email ?? "—"}</div>
                <div><b>Rôle :</b> <Badge variant="outline">{ticket.user?.role ?? "—"}</Badge></div>
                {ticket.user && (
                  <Link href={`/admin/utilisateurs?search=${encodeURIComponent(ticket.user.email)}`}>
                    <Button variant="link" size="sm" className="px-0">Voir le profil →</Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">📊 Métadonnées</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-1.5 text-muted-foreground">
                {cat && <div>Catégorie : <span className="text-foreground">{cat.icon} {cat.name}</span></div>}
                {ticket.sla_deadline && <div>SLA : {formatDate(ticket.sla_deadline)}</div>}
                {ticket.resolved_at && <div>Résolu : {formatDate(ticket.resolved_at)}</div>}
                {ticket.closed_at && <div>Fermé : {formatDate(ticket.closed_at)}</div>}
                <div>Créé : {formatDate(ticket.created_at)}</div>
                <div>MàJ : {formatDate(ticket.updated_at)}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
