import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@/api-client";
import { Loader2, MessageCircle, Mail, Clock, Save } from "lucide-react";

type SupportSettings = {
  whatsappNumber: string;
  supportEmail: string;
  supportHours: string;
};

export default function AdminParametres() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<SupportSettings>({
    queryKey: ["admin-support-settings"],
    queryFn: () => customFetch<SupportSettings>("/api/admin/support/settings", { method: "GET" }),
  });

  const [form, setForm] = useState<SupportSettings>({ whatsappNumber: "", supportEmail: "", supportHours: "" });
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: (body: SupportSettings) =>
      customFetch<SupportSettings>("/api/admin/support/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (resp) => {
      qc.setQueryData(["admin-support-settings"], resp);
      qc.invalidateQueries({ queryKey: ["support-settings"] });
      toast({ title: "Paramètres enregistrés", description: "Les coordonnées du support ont été mises à jour." });
    },
    onError: (e: any) => {
      toast({ title: "Erreur", description: e?.message ?? "Impossible d'enregistrer", variant: "destructive" });
    },
  });

  const dirty = !!data && (
    form.whatsappNumber !== data.whatsappNumber ||
    form.supportEmail !== data.supportEmail ||
    form.supportHours !== data.supportHours
  );

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-muted-foreground mt-1">
            Coordonnées du support visibles par les utilisateurs (page d'aide, bouton WhatsApp flottant).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contact support</CardTitle>
            <CardDescription>Ces informations apparaissent dans toute l'application.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="wa" className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-emerald-600" /> Numéro WhatsApp
                  </Label>
                  <Input
                    id="wa"
                    value={form.whatsappNumber}
                    onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                    placeholder="+225 07 00 00 00 00"
                    data-testid="input-wa-number"
                  />
                  <p className="text-xs text-muted-foreground">Format international avec indicatif pays (ex : +225…).</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-600" /> Email du support
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.supportEmail}
                    onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
                    placeholder="support@agroloopci.com"
                    data-testid="input-support-email"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="hours" className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" /> Horaires
                  </Label>
                  <Input
                    id="hours"
                    value={form.supportHours}
                    onChange={(e) => setForm({ ...form, supportHours: e.target.value })}
                    placeholder="Lun–Sam 8h–18h"
                    data-testid="input-support-hours"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => save.mutate(form)}
                    disabled={!dirty || save.isPending}
                    data-testid="btn-save-support"
                  >
                    {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Enregistrer
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
