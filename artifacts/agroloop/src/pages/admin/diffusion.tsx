import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin-api";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Users, AlertTriangle, ExternalLink } from "lucide-react";

const REGIONS = ["Abidjan", "Bouaké", "San-Pédro", "Korhogo", "Yamoussoukro", "Daloa", "Man", "Gagnoa"];

const TITLE_MAX = 80;
const MESSAGE_MAX = 500;

const AUDIENCE_LABEL: Record<string, string> = {
  all: "Tous les utilisateurs",
  producteur: "Producteurs",
  transformateur: "Transformateurs",
  region: "Par région",
};

export default function AdminDiffusion() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", message: "", link: "", audience: "all", audienceValue: "" });
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: history, isLoading } = useQuery({
    queryKey: ["broadcast-history"],
    queryFn: () => adminApi.broadcastHistory(),
  });

  const preview = useMutation({
    mutationFn: () => adminApi.broadcastPreview(form.audience, form.audienceValue || undefined),
    onSuccess: (r: any) => setPreviewCount(r.count),
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "", variant: "destructive" }),
  });

  const send = useMutation({
    mutationFn: () => adminApi.broadcast({
      title: form.title,
      message: form.message,
      audience: form.audience,
      audienceValue: form.audienceValue || undefined,
      ...(form.link.trim() ? { link: form.link.trim() } : {}),
    } as any),
    onSuccess: (r: any) => {
      toast({ title: "Diffusion envoyée", description: `${r.reach} destinataire(s)` });
      qc.invalidateQueries({ queryKey: ["broadcast-history"] });
      setForm({ title: "", message: "", link: "", audience: "all", audienceValue: "" });
      setPreviewCount(null);
      setConfirmOpen(false);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const isLink = form.link.trim().length > 0;
  const linkValid = !isLink || /^(https?:\/\/|\/)/i.test(form.link.trim());
  const audienceOk = form.audience !== "region" || !!form.audienceValue;
  const canSubmit =
    !!form.title.trim() &&
    !!form.message.trim() &&
    form.title.length <= TITLE_MAX &&
    form.message.length <= MESSAGE_MAX &&
    audienceOk &&
    linkValid;

  const audienceLabel = form.audience === "region"
    ? `Région : ${form.audienceValue}`
    : AUDIENCE_LABEL[form.audience];

  const onConfirmOpen = async () => {
    if (!canSubmit) return;
    try {
      const r: any = await preview.mutateAsync();
      setPreviewCount(r.count);
    } catch {/* noop */}
    setConfirmOpen(true);
  };

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-6">Diffusion</h1>

      <Card className="mb-6">
        <CardHeader><CardTitle>Nouvelle annonce</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <Label htmlFor="title">Titre</Label>
              <span className={`text-xs ${form.title.length > TITLE_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                {form.title.length}/{TITLE_MAX}
              </span>
            </div>
            <Input
              id="title"
              placeholder="Ex: Maintenance prévue ce dimanche"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={TITLE_MAX + 20}
              data-testid="input-broadcast-title"
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <Label htmlFor="message">Message</Label>
              <span className={`text-xs ${form.message.length > MESSAGE_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                {form.message.length}/{MESSAGE_MAX}
              </span>
            </div>
            <Textarea
              id="message"
              placeholder="Votre message…"
              rows={5}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              data-testid="input-broadcast-message"
            />
          </div>
          <div>
            <Label htmlFor="link">Lien (optionnel)</Label>
            <Input
              id="link"
              placeholder="https://… ou /marketplace"
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              data-testid="input-broadcast-link"
            />
            {isLink && !linkValid && (
              <p className="text-xs text-destructive mt-1">Le lien doit commencer par http(s):// ou /</p>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <Select value={form.audience} onValueChange={(v) => { setForm({ ...form, audience: v, audienceValue: "" }); setPreviewCount(null); }}>
              <SelectTrigger data-testid="select-audience"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les utilisateurs</SelectItem>
                <SelectItem value="producteur">Producteurs</SelectItem>
                <SelectItem value="transformateur">Transformateurs</SelectItem>
                <SelectItem value="region">Par région</SelectItem>
              </SelectContent>
            </Select>
            {form.audience === "region" && (
              <Select value={form.audienceValue} onValueChange={(v) => { setForm({ ...form, audienceValue: v }); setPreviewCount(null); }}>
                <SelectTrigger data-testid="select-region"><SelectValue placeholder="Choisir une région" /></SelectTrigger>
                <SelectContent>{REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => preview.mutate()} disabled={preview.isPending || !audienceOk} data-testid="button-preview">
              {preview.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
              Prévisualiser audience
            </Button>
            {previewCount !== null && <Badge variant="secondary" data-testid="badge-preview-count">{previewCount} destinataire(s)</Badge>}
          </div>

          <div className="border rounded-md p-3 bg-muted/30">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Aperçu de la notification</div>
            <div className="bg-white border rounded-md p-3 shadow-sm">
              <div className="font-semibold text-sm">{form.title || "Titre de l'annonce"}</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                {form.message || "Le contenu de votre message apparaîtra ici."}
              </div>
              {isLink && linkValid && (
                <div className="text-xs text-primary mt-2 inline-flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> {form.link}
                </div>
              )}
            </div>
          </div>

          <Button
            className="w-full"
            disabled={!canSubmit || send.isPending}
            onClick={onConfirmOpen}
            data-testid="btn-broadcast-send"
          >
            <Send className="h-4 w-4 mr-2" />Envoyer
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historique</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>
          ) : (
            <div className="space-y-3">
              {history?.map((n: any) => (
                <div key={n.id} className="border rounded-md p-3" data-testid={`broadcast-${n.id}`}>
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-medium">{n.title}</h4>
                    <Badge variant="outline">{n.reach} env.</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2 whitespace-pre-wrap">{n.message}</p>
                  <div className="text-xs text-muted-foreground">
                    {n.audience}{n.audienceValue ? ` (${n.audienceValue})` : ""} · {new Date(n.createdAt).toLocaleString("fr-FR")}
                  </div>
                </div>
              ))}
              {(!history || history.length === 0) && <p className="text-center text-muted-foreground py-8">Aucune diffusion</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={(o) => !send.isPending && setConfirmOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Confirmer la diffusion
            </DialogTitle>
            <DialogDescription>
              Cette action enverra une notification à <strong>{previewCount ?? "?"}</strong> destinataire(s).
              Cette opération est <strong>irréversible</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/40 rounded-md p-3 space-y-1 text-sm">
            <div><strong>Audience :</strong> {audienceLabel}</div>
            <div><strong>Titre :</strong> {form.title}</div>
            <div><strong>Message :</strong></div>
            <div className="whitespace-pre-wrap text-muted-foreground">{form.message}</div>
            {isLink && <div className="text-xs text-primary"><strong>Lien :</strong> {form.link}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={send.isPending}>Annuler</Button>
            <Button onClick={() => send.mutate()} disabled={send.isPending} data-testid="button-confirm-broadcast">
              {send.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Confirmer & envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
