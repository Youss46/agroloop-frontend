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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Pencil, GripVertical, Eye, Smartphone, Banknote, Loader2, AlertCircle,
  Plus, Trash2, CreditCard,
} from "lucide-react";
import {
  paymentSettingsApi, type AdminPaymentSetting, type PaymentMethod,
} from "@/lib/subscriptions-api";
import { CheckoutPaymentList } from "@/components/checkout-payment-list";
import {
  fetchAdminSupportSettings, updateAdminSupportSettings,
  type AdminSupportSettings,
} from "@/lib/support-api";
import { MessageSquare, Mail, Clock } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

const METHOD_COLORS: Record<PaymentMethod, { bg: string; text: string; border: string; leftBorder: string }> = {
  orange_money: { bg: "bg-orange-100", text: "text-orange-600", border: "border-orange-200", leftBorder: "border-l-orange-500" },
  wave:         { bg: "bg-blue-100",   text: "text-blue-600",   border: "border-blue-200",   leftBorder: "border-l-blue-600" },
  mtn_money:    { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200", leftBorder: "border-l-yellow-500" },
  virement:     { bg: "bg-gray-100",   text: "text-gray-600",   border: "border-gray-200",   leftBorder: "border-l-gray-500" },
  autre:        { bg: "bg-purple-100", text: "text-purple-600", border: "border-purple-200", leftBorder: "border-l-purple-500" },
};

const METHOD_PLACEHOLDERS: Record<PaymentMethod, string> = {
  orange_money: "+225 07 XX XX XX XX",
  wave: "+225 07 XX XX XX XX",
  mtn_money: "+225 05 XX XX XX XX",
  virement: "Banque · Agence · Numéro compte · IBAN",
  autre: "Coordonnées de paiement",
};

const METHOD_DEFAULTS: Record<PaymentMethod, { label: string; account_name: string; number: string; instructions: string }> = {
  orange_money: { label: "Orange Money", account_name: "AgroLoopCI", number: "+225 07 ", instructions: "Indiquer votre email en objet du paiement" },
  wave:         { label: "Wave",         account_name: "AgroLoopCI", number: "+225 07 ", instructions: "" },
  mtn_money:    { label: "MTN Money",    account_name: "AgroLoopCI", number: "+225 05 ", instructions: "" },
  virement:     { label: "Virement Bancaire", account_name: "AgroLoopCI SARL", number: "", instructions: "" },
  autre:        { label: "",             account_name: "",            number: "",       instructions: "" },
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  orange_money: "Orange Money",
  wave: "Wave",
  mtn_money: "MTN Money",
  virement: "Virement Bancaire",
  autre: "Autre",
};

const PLACEHOLDER_RE = /XX/;

function MethodIcon({ method }: { method: PaymentMethod }) {
  const c = METHOD_COLORS[method];
  const Icon = method === "virement" ? Banknote : method === "autre" ? CreditCard : Smartphone;
  return (
    <div className={`w-12 h-12 rounded-lg ${c.bg} ${c.text} flex items-center justify-center shrink-0`}>
      <Icon className="h-6 w-6" />
    </div>
  );
}

type DraftCreate = {
  method: PaymentMethod; label: string; account_name: string; number: string;
  instructions: string; is_active: boolean;
};
type DraftEdit = Omit<DraftCreate, "method">;

export default function AdminPaiementsConfigPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<AdminPaymentSetting | null>(null);
  const [editDraft, setEditDraft] = useState<DraftEdit | null>(null);
  const [createDraft, setCreateDraft] = useState<DraftCreate | null>(null);
  const [deleting, setDeleting] = useState<AdminPaymentSetting | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-payment-settings"],
    queryFn: () => paymentSettingsApi.adminList(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-payment-settings"] });
    qc.invalidateQueries({ queryKey: ["public-payment-settings"] });
  };

  const updateMut = useMutation({
    mutationFn: (vars: { id: number; body: any }) => paymentSettingsApi.update(vars.id, vars.body),
    onSuccess: () => {
      toast({ title: "Mode de paiement mis à jour ✓" });
      invalidate();
      setEditing(null); setEditDraft(null);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Échec", variant: "destructive" }),
  });

  const createMut = useMutation({
    mutationFn: (body: DraftCreate) => paymentSettingsApi.create({
      method: body.method, label: body.label, account_name: body.account_name,
      number: body.number, instructions: body.instructions.trim() || null, is_active: body.is_active,
    }),
    onSuccess: () => {
      toast({ title: "Mode de paiement ajouté ✓" });
      invalidate();
      setCreateDraft(null);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Échec", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => paymentSettingsApi.remove(id),
    onSuccess: () => {
      toast({ title: "Mode de paiement supprimé" });
      invalidate();
      setDeleting(null);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Échec", variant: "destructive" }),
  });

  // ── Support contact settings ──
  // Gated by `settings.view` / `settings.edit` to mirror the backend
  // (`/api/admin/support/settings` is protected by the `settings` resource).
  const { hasPermission } = useAuth();
  const canViewSettings = hasPermission("settings", "view");
  const canEditSettings = hasPermission("settings", "edit");
  const { data: supportSettings } = useQuery({
    queryKey: ["admin-support-settings"],
    queryFn: () => fetchAdminSupportSettings(),
    enabled: canViewSettings,
  });
  const [supportEdit, setSupportEdit] = useState<{ field: keyof AdminSupportSettings; value: string } | null>(null);
  const supportMut = useMutation({
    mutationFn: (body: Partial<AdminSupportSettings>) => updateAdminSupportSettings(body),
    onSuccess: () => {
      toast({ title: "Coordonnées de support mises à jour ✓" });
      qc.invalidateQueries({ queryKey: ["admin-support-settings"] });
      qc.invalidateQueries({ queryKey: ["support-settings"] });
      setSupportEdit(null);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Échec", variant: "destructive" }),
  });

  const reorderMut = useMutation({
    mutationFn: (ids: number[]) => paymentSettingsApi.reorder(ids),
    onSuccess: () => { toast({ title: "Ordre mis à jour ✓" }); invalidate(); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Échec du réordonnancement", variant: "destructive" }),
  });

  const toggleActive = (s: AdminPaymentSetting, next: boolean) => {
    updateMut.mutate({
      id: s.id,
      body: { label: s.label, account_name: s.account_name, number: s.number, instructions: s.instructions, is_active: next },
    });
  };

  const openEdit = (s: AdminPaymentSetting) => {
    setEditing(s);
    setEditDraft({
      label: s.label, account_name: s.account_name, number: s.number,
      instructions: s.instructions ?? "", is_active: s.is_active,
    });
  };

  const saveEdit = () => {
    if (!editing || !editDraft) return;
    updateMut.mutate({
      id: editing.id,
      body: {
        label: editDraft.label, account_name: editDraft.account_name, number: editDraft.number,
        instructions: editDraft.instructions.trim() || null, is_active: editDraft.is_active,
      },
    });
  };

  const openCreate = (preset?: PaymentMethod) => {
    const m: PaymentMethod = preset ?? "orange_money";
    const d = METHOD_DEFAULTS[m];
    setCreateDraft({ method: m, ...d, is_active: true });
  };

  const updateCreateMethod = (m: PaymentMethod) => {
    if (!createDraft) return;
    const d = METHOD_DEFAULTS[m];
    // keep user-entered fields if they typed something, otherwise apply defaults
    setCreateDraft({
      method: m,
      label: createDraft.label && createDraft.label !== METHOD_DEFAULTS[createDraft.method].label ? createDraft.label : d.label,
      account_name: createDraft.account_name && createDraft.account_name !== METHOD_DEFAULTS[createDraft.method].account_name ? createDraft.account_name : d.account_name,
      number: createDraft.number && createDraft.number !== METHOD_DEFAULTS[createDraft.method].number ? createDraft.number : d.number,
      instructions: createDraft.instructions && createDraft.instructions !== METHOD_DEFAULTS[createDraft.method].instructions ? createDraft.instructions : d.instructions,
      is_active: createDraft.is_active,
    });
  };

  const onDrop = (overId: number) => {
    if (!settings || draggingId == null || draggingId === overId) { setDraggingId(null); return; }
    const ids = settings.map((s) => s.id);
    const fromIdx = ids.indexOf(draggingId);
    const toIdx = ids.indexOf(overId);
    if (fromIdx < 0 || toIdx < 0) { setDraggingId(null); return; }
    const next = [...ids];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, draggingId);
    setDraggingId(null);
    reorderMut.mutate(next);
  };

  const lastEdit = useMemo(() => {
    if (!settings || settings.length === 0) return null;
    return [...settings].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))[0]!;
  }, [settings]);

  const existingMethods = new Set((settings ?? []).map((s) => s.method));

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-paiements-config">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Paramètres de paiement</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configurez les numéros affichés aux utilisateurs lors de la souscription à un abonnement.
            </p>
            {lastEdit && (
              <p className="text-xs text-muted-foreground mt-2">
                Dernière modification le{" "}
                <strong>{new Date(lastEdit.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</strong>
                {lastEdit.updated_by_name ? ` par ${lastEdit.updated_by_name}` : ""}
              </p>
            )}
          </div>
          <Button
            onClick={() => openCreate()}
            className="bg-green-600 hover:bg-green-700 text-white gap-2"
            data-testid="btn-add-payment"
          >
            <Plus className="h-4 w-4" /> Ajouter un mode de paiement
          </Button>
        </div>

        <Card className="border-none shadow-sm ring-1 ring-border/50">
          <CardHeader>
            <CardTitle className="text-base">Modes de paiement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading || !settings ? (
              [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)
            ) : settings.length === 0 ? (
              <div className="text-center py-12 px-6 flex flex-col items-center gap-4" data-testid="empty-payment-state">
                <CreditCard className="h-16 w-16 text-gray-300" />
                <div>
                  <div className="font-semibold text-lg">Aucun mode de paiement configuré</div>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md">
                    Ajoutez les coordonnées de paiement pour que les utilisateurs puissent souscrire à un abonnement.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center pt-2">
                  <Button onClick={() => openCreate("orange_money")} className="bg-orange-500 hover:bg-orange-600 text-white gap-2" data-testid="quick-add-orange">
                    <Plus className="h-4 w-4" /> Ajouter Orange Money
                  </Button>
                  <Button onClick={() => openCreate("wave")} className="bg-blue-600 hover:bg-blue-700 text-white gap-2" data-testid="quick-add-wave">
                    <Plus className="h-4 w-4" /> Ajouter Wave
                  </Button>
                  <Button onClick={() => openCreate("autre")} variant="outline" className="gap-2" data-testid="quick-add-custom">
                    <Plus className="h-4 w-4" /> Configurer manuellement
                  </Button>
                </div>
              </div>
            ) : (
              settings.map((s) => {
                const c = METHOD_COLORS[s.method];
                const placeholderWarn = PLACEHOLDER_RE.test(s.number);
                return (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={() => setDraggingId(s.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(s.id)}
                    className={`border border-l-4 ${c.leftBorder} rounded-lg p-4 flex items-center gap-4 bg-card transition-opacity ${s.is_active ? "" : "opacity-60"} ${draggingId === s.id ? "ring-2 ring-primary/40" : c.border}`}
                    data-testid={`payment-row-${s.method}`}
                  >
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
                      aria-label="Réordonner"
                      data-testid={`drag-${s.method}`}
                    >
                      <GripVertical className="h-5 w-5" />
                    </button>
                    <MethodIcon method={s.method} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{s.label}</span>
                        {!s.is_active && (
                          <span className="text-[10px] uppercase tracking-wide bg-gray-200 text-gray-700 px-2 py-0.5 rounded">Désactivé</span>
                        )}
                        {placeholderWarn && (
                          <span className="text-[10px] uppercase tracking-wide bg-orange-100 text-orange-700 px-2 py-0.5 rounded inline-flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Numéro non configuré
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{s.account_name}</div>
                      <div className="text-sm font-mono mt-0.5 break-all">{s.number}</div>
                      {s.instructions && (
                        <div className="text-xs text-muted-foreground italic mt-1">{s.instructions}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={s.is_active}
                          onCheckedChange={(v) => toggleActive(s, v)}
                          disabled={updateMut.isPending}
                          data-testid={`toggle-${s.method}`}
                        />
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {s.is_active ? "Actif" : "Inactif"}
                        </span>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(s)} data-testid={`btn-edit-${s.method}`}>
                        <Pencil className="h-3 w-3" /> Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        onClick={() => setDeleting(s)}
                        data-testid={`btn-delete-${s.method}`}
                      >
                        <Trash2 className="h-3 w-3" /> Supprimer
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm ring-1 ring-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" /> Aperçu — tel que vu par l'utilisateur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-md mx-auto rounded-lg border bg-background p-4">
              <CheckoutPaymentList settings={(settings ?? []).filter((s) => s.is_active)} />
            </div>
          </CardContent>
        </Card>

        {/* ── Contact Support ──────────────────────────────────── */}
        {canViewSettings ? (
        <Card className="border-none shadow-sm ring-1 ring-border/50" data-testid="card-support-contact">
          <CardHeader>
            <CardTitle className="text-base">Contact support</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Coordonnées affichées aux utilisateurs sur la page d'aide et dans le bouton flottant de support.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { field: "whatsappNumber" as const, icon: MessageSquare, label: "WhatsApp support", color: "text-green-600 bg-green-50" },
              { field: "supportEmail" as const,   icon: Mail,           label: "Email support",    color: "text-blue-600 bg-blue-50" },
              { field: "supportHours" as const,   icon: Clock,          label: "Heures d'ouverture", color: "text-amber-600 bg-amber-50" },
            ].map(({ field, icon: Icon, label, color }) => (
              <div
                key={field}
                className="border rounded-lg p-4 flex items-center gap-4 bg-card"
                data-testid={`support-contact-row-${field}`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-muted-foreground">{label}</div>
                  <div className="font-mono text-sm break-all">
                    {supportSettings ? supportSettings[field] : <Skeleton className="h-4 w-40" />}
                  </div>
                </div>
                {canEditSettings && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 shrink-0"
                    onClick={() => supportSettings && setSupportEdit({ field, value: supportSettings[field] })}
                    disabled={!supportSettings}
                    data-testid={`btn-edit-support-${field}`}
                  >
                    <Pencil className="h-3 w-3" /> Modifier
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
        ) : null}
      </div>

      {/* ── EDIT MODAL ──────────────────────────────────────────── */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && (setEditing(null), setEditDraft(null))}>
        <DialogContent data-testid="edit-payment-modal">
          <DialogHeader>
            <DialogTitle>Modifier — {editing?.label}</DialogTitle>
            <DialogDescription>
              Les modifications sont visibles immédiatement par les utilisateurs.
            </DialogDescription>
          </DialogHeader>

          {editDraft && editing && (
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="ed-label" className="mb-1 block">Nom affiché</Label>
                <Input id="ed-label" value={editDraft.label} onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })} data-testid="input-edit-label" />
              </div>
              <div>
                <Label htmlFor="ed-account" className="mb-1 block">Nom du compte</Label>
                <Input id="ed-account" value={editDraft.account_name} onChange={(e) => setEditDraft({ ...editDraft, account_name: e.target.value })} data-testid="input-edit-account" />
              </div>
              <div>
                <Label htmlFor="ed-number" className="mb-1 block">Numéro / Coordonnées</Label>
                <Input
                  id="ed-number"
                  value={editDraft.number}
                  onChange={(e) => setEditDraft({ ...editDraft, number: e.target.value })}
                  placeholder={METHOD_PLACEHOLDERS[editing.method]}
                  data-testid="input-edit-number"
                />
              </div>
              <div>
                <Label htmlFor="ed-instr" className="mb-1 block">Instructions supplémentaires</Label>
                <Textarea
                  id="ed-instr"
                  value={editDraft.instructions}
                  onChange={(e) => setEditDraft({ ...editDraft, instructions: e.target.value })}
                  placeholder="Ex : Indiquer votre email en objet du paiement"
                  rows={2}
                  data-testid="input-edit-instructions"
                />
              </div>
              <div className="flex items-center justify-between border rounded-md p-3">
                <Label htmlFor="ed-active" className="cursor-pointer">Activer ce mode de paiement</Label>
                <Switch
                  id="ed-active"
                  checked={editDraft.is_active}
                  onCheckedChange={(v) => setEditDraft({ ...editDraft, is_active: v })}
                  data-testid="toggle-edit-active"
                />
              </div>
              {!editDraft.is_active && settings && settings.filter(s => s.is_active && s.id !== editing.id).length === 0 && (
                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Attention : vous devez avoir au moins un mode de paiement actif.</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setEditing(null); setEditDraft(null); }}>Annuler</Button>
            <Button onClick={saveEdit} disabled={updateMut.isPending} data-testid="btn-save-payment">
              {updateMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer les modifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CREATE MODAL ────────────────────────────────────────── */}
      <Dialog open={!!createDraft} onOpenChange={(o) => !o && setCreateDraft(null)}>
        <DialogContent data-testid="create-payment-modal">
          <DialogHeader>
            <DialogTitle>Ajouter un mode de paiement</DialogTitle>
            <DialogDescription>
              Renseignez les coordonnées qui seront affichées aux utilisateurs lors de leur souscription.
            </DialogDescription>
          </DialogHeader>

          {createDraft && (
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="cr-method" className="mb-1 block">Méthode</Label>
                <Select value={createDraft.method} onValueChange={(v) => updateCreateMethod(v as PaymentMethod)}>
                  <SelectTrigger id="cr-method" data-testid="select-create-method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["orange_money", "wave", "mtn_money", "virement", "autre"] as PaymentMethod[]).map((m) => (
                      <SelectItem key={m} value={m} disabled={existingMethods.has(m)}>
                        {METHOD_LABELS[m]}{existingMethods.has(m) ? " (déjà ajouté)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cr-label" className="mb-1 block">Nom affiché</Label>
                <Input id="cr-label" value={createDraft.label} onChange={(e) => setCreateDraft({ ...createDraft, label: e.target.value })} data-testid="input-create-label" />
              </div>
              <div>
                <Label htmlFor="cr-account" className="mb-1 block">Nom du compte</Label>
                <Input id="cr-account" value={createDraft.account_name} onChange={(e) => setCreateDraft({ ...createDraft, account_name: e.target.value })} data-testid="input-create-account" />
              </div>
              <div>
                <Label htmlFor="cr-number" className="mb-1 block">Numéro / Coordonnées</Label>
                <Input
                  id="cr-number"
                  value={createDraft.number}
                  onChange={(e) => setCreateDraft({ ...createDraft, number: e.target.value })}
                  placeholder={METHOD_PLACEHOLDERS[createDraft.method]}
                  data-testid="input-create-number"
                />
              </div>
              <div>
                <Label htmlFor="cr-instr" className="mb-1 block">Instructions supplémentaires</Label>
                <Textarea
                  id="cr-instr"
                  value={createDraft.instructions}
                  onChange={(e) => setCreateDraft({ ...createDraft, instructions: e.target.value })}
                  placeholder="Ex : Indiquer votre email en objet du paiement"
                  rows={2}
                  data-testid="input-create-instructions"
                />
              </div>
              <div className="flex items-center justify-between border rounded-md p-3">
                <Label htmlFor="cr-active" className="cursor-pointer">Activer immédiatement</Label>
                <Switch
                  id="cr-active"
                  checked={createDraft.is_active}
                  onCheckedChange={(v) => setCreateDraft({ ...createDraft, is_active: v })}
                  data-testid="toggle-create-active"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateDraft(null)}>Annuler</Button>
            <Button
              onClick={() => createDraft && createMut.mutate(createDraft)}
              disabled={createMut.isPending || !createDraft?.label.trim() || !createDraft?.account_name.trim()}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="btn-create-payment"
            >
              {createMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SUPPORT CONTACT EDIT MODAL ──────────────────────────── */}
      <Dialog open={!!supportEdit} onOpenChange={(o) => !o && setSupportEdit(null)}>
        <DialogContent data-testid="edit-support-modal">
          <DialogHeader>
            <DialogTitle>
              Modifier — {
                supportEdit?.field === "whatsappNumber" ? "WhatsApp support" :
                supportEdit?.field === "supportEmail"   ? "Email support" :
                "Heures d'ouverture"
              }
            </DialogTitle>
            <DialogDescription>
              Cette information est visible publiquement par les utilisateurs.
            </DialogDescription>
          </DialogHeader>
          {supportEdit && (
            <div className="py-2">
              <Label htmlFor="support-edit-input" className="mb-1 block">
                {supportEdit.field === "whatsappNumber" ? "Numéro WhatsApp (format international)" :
                 supportEdit.field === "supportEmail" ? "Adresse email" : "Plage horaire"}
              </Label>
              <Input
                id="support-edit-input"
                value={supportEdit.value}
                onChange={(e) => setSupportEdit({ ...supportEdit, value: e.target.value })}
                placeholder={
                  supportEdit.field === "whatsappNumber" ? "+225 07 XX XX XX XX" :
                  supportEdit.field === "supportEmail" ? "support@agroloopci.ci" :
                  "Lun–Sam 8h–18h"
                }
                data-testid="input-edit-support"
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSupportEdit(null)}>Annuler</Button>
            <Button
              onClick={() => supportEdit && supportMut.mutate({ [supportEdit.field]: supportEdit.value.trim() } as Partial<AdminSupportSettings>)}
              disabled={supportMut.isPending || !supportEdit?.value.trim()}
              data-testid="btn-save-support"
            >
              {supportMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRM ──────────────────────────────────────── */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent data-testid="delete-payment-modal">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce mode de paiement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le mode <strong>{deleting?.label}</strong> sera définitivement retiré et ne sera plus proposé aux utilisateurs lors de leur souscription. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMut.mutate(deleting.id)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="btn-confirm-delete-payment"
            >
              {deleteMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
