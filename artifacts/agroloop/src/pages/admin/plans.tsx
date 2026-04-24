import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Pencil, History, TrendingUp, TrendingDown, Loader2, Users, Sparkles, Tag, AlertCircle,
} from "lucide-react";
import {
  subscriptionsApi, type AdminPlan, type PriceHistoryEntry,
} from "@/lib/subscriptions-api";

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  gratuit:  { bg: "bg-gray-50",    text: "text-gray-700",    border: "border-gray-200",    ring: "ring-gray-200" },
  pro:      { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300", ring: "ring-emerald-300" },
  business: { bg: "bg-amber-50",   text: "text-amber-800",   border: "border-amber-300",   ring: "ring-amber-300" },
};

function formatFcfa(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

type Draft = {
  label: string;
  description: string;
  price_fcfa: number;
  contacts_per_month: number;
  is_active: boolean;
  reason: string;
};

export default function AdminPlansPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [historyOf, setHistoryOf] = useState<AdminPlan | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => subscriptionsApi.adminListPlans(),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: number; body: Draft }) =>
      subscriptionsApi.adminUpdatePlan(vars.id, vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      qc.invalidateQueries({ queryKey: ["plans"] });
      toast({ title: "Plan mis à jour", description: "Les nouveaux tarifs s'appliqueront aux prochains abonnements." });
      setEditing(null);
      setDraft(null);
    },
    onError: (e: any) => {
      toast({ title: "Erreur", description: e?.message ?? "Impossible de mettre à jour le plan.", variant: "destructive" });
    },
  });

  function openEdit(p: AdminPlan) {
    setEditing(p);
    setDraft({
      label: p.label || p.name,
      description: p.description ?? "",
      price_fcfa: p.price_fcfa,
      contacts_per_month: p.contacts_per_month,
      is_active: p.is_active,
      reason: "",
    });
  }

  function submit() {
    if (!editing || !draft) return;
    if (draft.reason.trim().length < 10) {
      toast({ title: "Motif requis", description: "Veuillez justifier le changement (10 caractères minimum).", variant: "destructive" });
      return;
    }
    if (draft.price_fcfa < 0 || !Number.isFinite(draft.price_fcfa)) {
      toast({ title: "Prix invalide", description: "Le prix doit être un nombre positif ou nul.", variant: "destructive" });
      return;
    }
    updateMut.mutate({ id: editing.id, body: draft });
  }

  const priceDelta = useMemo(() => {
    if (!editing || !draft) return 0;
    return draft.price_fcfa - editing.price_fcfa;
  }, [editing, draft]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tarifs & Plans</h1>
          <p className="text-muted-foreground mt-1">
            Modifiez les prix et descriptions des plans d'abonnement. Les changements n'affectent que les nouveaux abonnements.
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3 items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <strong>Important :</strong> Les abonnements actifs conservent le prix payé. Les nouveaux tarifs s'appliquent uniquement aux nouvelles souscriptions et renouvellements.
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-80 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {plans?.map(p => {
              const colors = PLAN_COLORS[p.name] ?? PLAN_COLORS.gratuit;
              const lastChange = [...(p.price_history ?? [])].sort(
                (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
              )[0];
              return (
                <Card
                  key={p.id}
                  className={`relative border-2 ${colors.border} ${p.is_popular ? `ring-2 ${colors.ring} ring-offset-2` : ""} ${!p.is_active ? "opacity-60" : ""}`}
                  data-testid={`card-plan-${p.name}`}
                >
                  {p.is_popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-emerald-600 hover:bg-emerald-700 gap-1">
                        <Sparkles className="h-3 w-3" /> Populaire
                      </Badge>
                    </div>
                  )}
                  {!p.is_active && (
                    <div className="absolute -top-3 right-3">
                      <Badge variant="secondary">Désactivé</Badge>
                    </div>
                  )}
                  <CardHeader className={`${colors.bg} rounded-t-lg`}>
                    <div className="flex items-center gap-2">
                      <Tag className={`h-5 w-5 ${colors.text}`} />
                      <CardTitle className={`text-xl ${colors.text} capitalize`}>
                        {p.label || p.name}
                      </CardTitle>
                    </div>
                    <div className="text-3xl font-bold mt-2 tabular-nums">
                      {p.price_fcfa === 0 ? "Gratuit" : formatFcfa(p.price_fcfa)}
                      {p.price_fcfa > 0 && <span className="text-sm font-normal text-muted-foreground">/mois</span>}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3 text-sm">
                    <p className="text-muted-foreground line-clamp-2 min-h-[2.5em]">{p.description}</p>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{p.contacts_per_month} contacts/mois</span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-3">
                      <div className="text-muted-foreground">
                        <div className="text-xs">Abonnés actifs</div>
                        <div className="font-semibold text-foreground tabular-nums">{p.active_subscribers}</div>
                      </div>
                      <div className="text-right text-muted-foreground">
                        <div className="text-xs">Modifié</div>
                        <div className="text-xs font-medium">{p.updated_by_name ?? "—"}</div>
                      </div>
                    </div>
                    {lastChange && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t pt-2">
                        {lastChange.new_price > lastChange.old_price ? (
                          <TrendingUp className="h-3.5 w-3.5 text-red-600" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                        <span>Dernier changement : {formatFcfa(lastChange.old_price)} → {formatFcfa(lastChange.new_price)}</span>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => openEdit(p)}
                        data-testid={`btn-edit-plan-${p.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => setHistoryOf(p)}
                        disabled={(p.price_history?.length ?? 0) === 0}
                        data-testid={`btn-history-plan-${p.name}`}
                      >
                        <History className="h-3.5 w-3.5" /> Historique
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setDraft(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le plan {editing?.label || editing?.name}</DialogTitle>
            <DialogDescription>
              Les changements de prix sont enregistrés dans l'historique avec votre nom et le motif.
            </DialogDescription>
          </DialogHeader>

          {draft && editing && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="label">Nom affiché</Label>
                <Input
                  id="label"
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  data-testid="input-plan-label"
                />
              </div>

              <div>
                <Label htmlFor="price">Prix mensuel (FCFA)</Label>
                <div className="relative">
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step={500}
                    value={draft.price_fcfa}
                    onChange={(e) => setDraft({ ...draft, price_fcfa: Number(e.target.value) })}
                    className="text-2xl font-bold h-14 tabular-nums pr-16"
                    data-testid="input-plan-price"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">FCFA</span>
                </div>
                {priceDelta !== 0 && (
                  <div className={`flex items-center gap-1 mt-1 text-sm font-medium ${priceDelta > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {priceDelta > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {priceDelta > 0 ? "+" : ""}{formatFcfa(priceDelta)} ({editing.price_fcfa === 0 ? "—" : `${((priceDelta / editing.price_fcfa) * 100).toFixed(1)}%`})
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="contacts">Contacts par mois</Label>
                <Input
                  id="contacts"
                  type="number"
                  min={0}
                  value={draft.contacts_per_month}
                  onChange={(e) => setDraft({ ...draft, contacts_per_month: Number(e.target.value) })}
                  data-testid="input-plan-contacts"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  data-testid="input-plan-description"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="is_active" className="cursor-pointer">Plan actif</Label>
                  <p className="text-xs text-muted-foreground">Si désactivé, le plan n'apparaît plus pour les nouveaux abonnés.</p>
                </div>
                <Switch
                  id="is_active"
                  checked={draft.is_active}
                  onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
                  data-testid="switch-plan-active"
                />
              </div>

              <div>
                <Label htmlFor="reason">
                  Motif du changement <span className="text-red-600">*</span>
                </Label>
                <Textarea
                  id="reason"
                  rows={3}
                  placeholder="Ex : Ajustement tarifaire annuel, alignement marché, promotion..."
                  value={draft.reason}
                  onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                  data-testid="input-plan-reason"
                />
                <p className="text-xs text-muted-foreground mt-1">Minimum 10 caractères. Sera enregistré dans l'historique.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setDraft(null); }}>
              Annuler
            </Button>
            <Button onClick={submit} disabled={updateMut.isPending} data-testid="btn-save-plan">
              {updateMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyOf} onOpenChange={(o) => { if (!o) setHistoryOf(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historique — {historyOf?.label || historyOf?.name}</DialogTitle>
            <DialogDescription>Toutes les modifications de prix de ce plan.</DialogDescription>
          </DialogHeader>
          <HistoryList entries={historyOf?.price_history ?? []} />
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function HistoryList({ entries }: { entries: PriceHistoryEntry[] }) {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
  );
  if (sorted.length === 0) {
    return <div className="text-center text-muted-foreground py-8">Aucun changement de prix enregistré.</div>;
  }
  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
      {sorted.map((h, i) => {
        const up = h.new_price > h.old_price;
        return (
          <div key={i} className="flex gap-3 border-l-2 border-muted pl-4 pb-3 relative">
            <div className={`absolute -left-2 top-0 w-4 h-4 rounded-full ${up ? "bg-red-500" : "bg-emerald-500"} ring-4 ring-background`} />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                {up ? (
                  <TrendingUp className="h-4 w-4 text-red-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-emerald-600" />
                )}
                <span className="tabular-nums">{formatFcfa(h.old_price)}</span>
                <span className="text-muted-foreground">→</span>
                <span className="tabular-nums font-bold">{formatFcfa(h.new_price)}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {formatDate(h.changed_at)} · par {h.changed_by_name ?? `Admin #${h.changed_by}`}
              </div>
              <div className="text-sm mt-1.5 text-foreground bg-muted/50 rounded p-2">
                {h.reason}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
