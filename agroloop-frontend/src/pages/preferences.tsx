import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import {
  fetchPreferences,
  updatePreferences,
  RESIDU_TYPES,
  REGIONS,
  type UserPrefs,
} from "@/lib/notifications-api";
import { Settings, BellRing, Loader2, Eye } from "lucide-react";
import { customFetch } from "@/api-client";

function ChipMulti({
  label,
  options,
  values,
  onChange,
  testIdPrefix,
}: { label: string; options: readonly string[]; values: string[]; onChange: (next: string[]) => void; testIdPrefix: string }) {
  const toggle = (v: string) => {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  };
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = values.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"}`}
              data-testid={`chip-${testIdPrefix}-${opt}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PreferencesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isTransformateur = user?.role === "transformateur";

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["preferences"],
    queryFn: fetchPreferences,
  });

  const [draft, setDraft] = useState<UserPrefs | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [showOnline, setShowOnline] = useState(true);

  const { data: onlinePref } = useQuery({
    queryKey: ["online-status-pref"],
    queryFn: () => customFetch<{ showOnlineStatus: boolean }>("/api/users/me/online-status"),
  });

  useEffect(() => {
    if (onlinePref) setShowOnline(onlinePref.showOnlineStatus);
  }, [onlinePref]);

  const saveOnline = useMutation({
    mutationFn: (v: boolean) =>
      customFetch<{ showOnlineStatus: boolean }>("/api/users/me/online-status", {
        method: "PATCH",
        body: JSON.stringify({ showOnlineStatus: v }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["online-status-pref"] });
      qc.invalidateQueries({ queryKey: ["user-status"] });
    },
  });

  useEffect(() => {
    if (prefs) {
      setDraft(prefs);
      setAlertsEnabled(prefs.notifOffreMatch);
    }
  }, [prefs]);

  const save = useMutation({
    mutationFn: (b: Partial<UserPrefs>) => updatePreferences(b),
    onSuccess: () => {
      toast({ title: "Préférences mises à jour ✓" });
      qc.invalidateQueries({ queryKey: ["preferences"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Échec", variant: "destructive" }),
  });

  if (isLoading || !draft) {
    return (
      <div className="container py-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  function update<K extends keyof UserPrefs>(k: K, v: UserPrefs[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }

  function onSave() {
    if (!draft) return;
    const body: Partial<UserPrefs> = {
      filieresSouhaitees: draft.filieresSouhaitees,
      residusSouhaites: alertsEnabled ? draft.residusSouhaites : [],
      regionsSouhaitees: alertsEnabled ? draft.regionsSouhaitees : [],
      prixMaxFcfa: alertsEnabled ? draft.prixMaxFcfa : null,
      notifNouveauMessage: draft.notifNouveauMessage,
      notifOffreMatch: alertsEnabled,
      notifTransaction: draft.notifTransaction,
      notifAvis: draft.notifAvis,
    };
    save.mutate(body);
  }

  return (
    <div className="container py-8 max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Mes préférences</h1>
      </div>

      {isTransformateur && (
        <Card data-testid="card-alerts">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" />
              Recevoir des alertes pour les nouvelles offres
            </CardTitle>
            <CardDescription>
              Vous serez alerté dès qu'une offre correspond à vos critères.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <Label htmlFor="alerts-on">Activer les alertes</Label>
              <Switch
                id="alerts-on"
                checked={alertsEnabled}
                onCheckedChange={setAlertsEnabled}
                data-testid="switch-alerts-enabled"
              />
            </div>

            {alertsEnabled && (
              <div className="space-y-5 pt-2">
                <ChipMulti
                  label="Types de résidus souhaités"
                  options={RESIDU_TYPES}
                  values={draft.residusSouhaites}
                  onChange={(v) => update("residusSouhaites", v)}
                  testIdPrefix="residu"
                />
                <ChipMulti
                  label="Régions souhaitées"
                  options={REGIONS}
                  values={draft.regionsSouhaitees}
                  onChange={(v) => update("regionsSouhaitees", v)}
                  testIdPrefix="region"
                />
                <div>
                  <Label htmlFor="prix-max" className="mb-2 block">Prix maximum (FCFA)</Label>
                  <Input
                    id="prix-max"
                    type="number"
                    min={0}
                    placeholder="Aucune limite"
                    value={draft.prixMaxFcfa ?? ""}
                    onChange={(e) => update("prixMaxFcfa", e.target.value === "" ? null : Number(e.target.value))}
                    data-testid="input-prix-max"
                  />
                </div>
                {draft.residusSouhaites.length === 0 && draft.regionsSouhaitees.length === 0 && draft.prixMaxFcfa == null && (
                  <Badge variant="secondary">Aucun filtre — vous recevrez toutes les nouvelles offres</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-privacy-prefs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> Confidentialité</CardTitle>
          <CardDescription>Gérez la visibilité de votre activité.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="show-online">Afficher mon statut en ligne</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Les autres utilisateurs verront un point vert lorsque vous êtes en ligne.
              </p>
            </div>
            <Switch
              id="show-online"
              checked={showOnline}
              onCheckedChange={(v) => { setShowOnline(v); saveOnline.mutate(v); }}
              data-testid="switch-show-online-status"
            />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-notif-prefs">
        <CardHeader>
          <CardTitle>Mes préférences de notifications</CardTitle>
          <CardDescription>Choisissez les notifications que vous souhaitez recevoir.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {([
            { key: "notifNouveauMessage" as const, label: "💬 Nouveaux messages" },
            { key: "notifOffreMatch" as const, label: "📦 Offres correspondantes", hideForNonTransfo: true },
            { key: "notifTransaction" as const, label: "🔄 Transactions" },
            { key: "notifAvis" as const, label: "⭐ Nouveaux avis" },
          ]).filter(item => !item.hideForNonTransfo || isTransformateur).map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <Label htmlFor={item.key}>{item.label}</Label>
              <Switch
                id={item.key}
                checked={item.key === "notifOffreMatch" ? alertsEnabled : Boolean(draft[item.key])}
                onCheckedChange={(v) => {
                  if (item.key === "notifOffreMatch") setAlertsEnabled(v);
                  else update(item.key, v as any);
                }}
                data-testid={`switch-${item.key}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={save.isPending} data-testid="button-save-preferences">
          {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Enregistrer mes préférences
        </Button>
      </div>
    </div>
  );
}
