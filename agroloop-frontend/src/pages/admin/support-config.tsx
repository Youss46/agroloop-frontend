import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { supportApi, type SupportCategory, type SupportTemplate } from "@/lib/support-tickets-api";

export default function AdminSupportConfigPage() {
  return (
    <AdminLayout>
      <div className="space-y-4 max-w-5xl" data-testid="support-config-page">
        <div className="flex items-center gap-2">
          <Link href="/admin/support">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Retour</Button>
          </Link>
          <h1 className="text-2xl font-bold">⚙️ Configuration du support</h1>
        </div>

        <Tabs defaultValue="categories">
          <TabsList>
            <TabsTrigger value="categories">📂 Catégories</TabsTrigger>
            <TabsTrigger value="templates">📋 Modèles de réponse</TabsTrigger>
          </TabsList>
          <TabsContent value="categories" className="mt-4"><CategoriesTab /></TabsContent>
          <TabsContent value="templates" className="mt-4"><TemplatesTab /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function CategoriesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["support-cats-admin"], queryFn: () => supportApi.listCategoriesAdmin() });
  const [editing, setEditing] = useState<Partial<SupportCategory> | null>(null);

  const saveMut = useMutation({
    mutationFn: (cat: Partial<SupportCategory>) =>
      cat.id ? supportApi.updateCategory(cat.id, cat) : supportApi.createCategory(cat),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-cats-admin"] });
      qc.invalidateQueries({ queryKey: ["support-cats-public"] });
      toast({ title: "Catégorie enregistrée" });
      setEditing(null);
    },
    onError: (e: any) => toast({ title: "Erreur", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => supportApi.deleteCategory(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["support-cats-admin"] }); toast({ title: "Catégorie supprimée" }); },
    onError: (e: any) => toast({ title: "Erreur", description: String(e?.message ?? e), variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Catégories de tickets</CardTitle>
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditing({ name: "", icon: "📌", color: "#6B7280", sla_hours: 48, is_active: true, position: 0 })}>
              <Plus className="h-4 w-4 mr-1" />Nouvelle catégorie
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? "Modifier" : "Nouvelle catégorie"}</DialogTitle></DialogHeader>
            {editing && <CategoryForm cat={editing} onChange={setEditing} />}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
              <Button onClick={() => editing && saveMut.mutate(editing)} disabled={saveMut.isPending}>
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <div>Chargement…</div> : (
          <div className="divide-y">
            {(data?.items ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-3" data-testid={`cat-${c.id}`}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: `${c.color}22`, color: c.color }}>
                  {c.icon}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">SLA {c.sla_hours} h · {c.is_active ? "Active" : "Inactive"}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setEditing(c)} data-testid={`edit-cat-${c.id}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => { if (confirm(`Supprimer la catégorie ${c.name} ?`)) delMut.mutate(c.id); }}
                  data-testid={`del-cat-${c.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryForm({ cat, onChange }: { cat: Partial<SupportCategory>; onChange: (c: Partial<SupportCategory>) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium">Nom</label>
        <Input value={cat.name ?? ""} onChange={(e) => onChange({ ...cat, name: e.target.value })} data-testid="cat-name" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium">Icône (emoji)</label>
          <Input value={cat.icon ?? ""} onChange={(e) => onChange({ ...cat, icon: e.target.value })} maxLength={4} data-testid="cat-icon" />
        </div>
        <div>
          <label className="text-xs font-medium">Couleur</label>
          <Input type="color" value={cat.color ?? "#6B7280"} onChange={(e) => onChange({ ...cat, color: e.target.value })} data-testid="cat-color" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium">SLA (heures)</label>
        <Input
          type="number" min={1} max={720}
          value={cat.sla_hours ?? 48}
          onChange={(e) => onChange({ ...cat, sla_hours: Number(e.target.value) })}
          data-testid="cat-sla"
        />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox" checked={cat.is_active ?? true}
          onChange={(e) => onChange({ ...cat, is_active: e.target.checked })}
        />
        Active
      </label>
    </div>
  );
}

function TemplatesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["support-templates"], queryFn: () => supportApi.listTemplates() });
  const { data: cats } = useQuery({ queryKey: ["support-cats-admin"], queryFn: () => supportApi.listCategoriesAdmin() });
  const [editing, setEditing] = useState<Partial<SupportTemplate> | null>(null);

  const saveMut = useMutation({
    mutationFn: (t: Partial<SupportTemplate>) =>
      t.id
        ? supportApi.updateTemplate(t.id, { title: t.title!, content: t.content!, category_id: t.category_id ?? null })
        : supportApi.createTemplate({ title: t.title!, content: t.content!, category_id: t.category_id ?? null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["support-templates"] }); toast({ title: "Modèle enregistré" }); setEditing(null); },
    onError: (e: any) => toast({ title: "Erreur", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => supportApi.deleteTemplate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["support-templates"] }); toast({ title: "Modèle supprimé" }); },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Modèles de réponse</CardTitle>
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditing({ title: "", content: "", category_id: null })}>
              <Plus className="h-4 w-4 mr-1" />Nouveau modèle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{editing?.id ? "Modifier le modèle" : "Nouveau modèle"}</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium">Titre</label>
                  <Input
                    value={editing.title ?? ""}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    data-testid="tpl-title"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Catégorie associée (optionnel)</label>
                  <Select
                    value={editing.category_id ? String(editing.category_id) : "none"}
                    onValueChange={(v) => setEditing({ ...editing, category_id: v === "none" ? null : Number(v) })}
                  >
                    <SelectTrigger data-testid="tpl-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {cats?.items.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.icon} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium">Contenu</label>
                  <Textarea
                    rows={8}
                    value={editing.content ?? ""}
                    onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                    placeholder="Bonjour {{nom}}, …"
                    data-testid="tpl-content"
                  />
                  <div className="text-xs text-muted-foreground mt-1">Variables disponibles : {"{{nom}}"}, {"{{reference}}"}.</div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
              <Button
                onClick={() => editing?.title?.trim() && editing.content?.trim() && saveMut.mutate(editing)}
                disabled={saveMut.isPending}
              >
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <div>Chargement…</div> : (data?.items ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Aucun modèle. Créez-en un pour gagner du temps !</div>
        ) : (
          <div className="divide-y">
            {data!.items.map((t) => (
              <div key={t.id} className="py-3 flex items-start gap-3" data-testid={`tpl-${t.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    {t.title}
                    {t.category && <Badge variant="outline" className="text-[10px]">{t.category.icon} {t.category.name}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.content}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Utilisé {t.usage_count} fois</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setEditing(t)} data-testid={`edit-tpl-${t.id}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon" variant="ghost" className="text-red-600"
                  onClick={() => { if (confirm(`Supprimer "${t.title}" ?`)) delMut.mutate(t.id); }}
                  data-testid={`del-tpl-${t.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
