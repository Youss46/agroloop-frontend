import { useState, useMemo } from "react";
import { Calculator, Coins, Leaf, Recycle, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// Reference factors per residu type — coarse industry estimates for Côte d'Ivoire valorisation usage.
// Values: revenuFcfaParKg, energieKwhParKg (combustion/biogaz potential), co2EvitéKgParKg, compostKgParKg.
const FACTEURS: Record<string, { revenu: number; energie: number; co2: number; compost: number }> = {
  "Coques de cacao": { revenu: 60, energie: 4.0, co2: 1.8, compost: 0.6 },
  "Bagasse de canne": { revenu: 35, energie: 3.5, co2: 1.5, compost: 0.5 },
  "Coques de café": { revenu: 55, energie: 4.5, co2: 1.9, compost: 0.55 },
  "Coques de palmiste": { revenu: 70, energie: 4.8, co2: 2.0, compost: 0.4 },
  "Tourteaux de coton": { revenu: 90, energie: 4.2, co2: 1.7, compost: 0.7 },
  "Drêches de brasserie": { revenu: 40, energie: 2.0, co2: 0.9, compost: 0.8 },
  "Pulpe de café": { revenu: 45, energie: 1.8, co2: 1.1, compost: 0.75 },
  "Marc de café": { revenu: 50, energie: 4.5, co2: 1.6, compost: 0.7 },
  "Sciure de bois": { revenu: 40, energie: 4.2, co2: 1.8, compost: 0.3 },
  "Coques d'arachide": { revenu: 50, energie: 4.0, co2: 1.7, compost: 0.55 },
  "Pailles de riz": { revenu: 30, energie: 3.2, co2: 1.4, compost: 0.65 },
  "Tiges de manioc": { revenu: 35, energie: 3.0, co2: 1.3, compost: 0.6 },
};

const TYPES = Object.keys(FACTEURS);

const formatNumber = (n: number) => new Intl.NumberFormat("fr-CI", { maximumFractionDigits: 0 }).format(n);

export default function Calculateur() {
  const { toast } = useToast();
  const [type, setType] = useState<string>(TYPES[0]);
  const [quantite, setQuantite] = useState<string>("1000");

  const qty = Math.max(0, Number(quantite) || 0);
  const f = FACTEURS[type];

  const result = useMemo(() => ({
    revenu: qty * f.revenu,
    energie: qty * f.energie,
    co2: qty * f.co2,
    compost: qty * f.compost,
  }), [qty, f]);

  const equivalentMaisons = Math.round(result.energie / 3500); // ~3500 kWh/an/foyer ivoirien
  const equivalentVoitures = Math.round(result.co2 / 4600); // ~4.6 t CO2/an/voiture

  const onShare = async () => {
    const msg = `🌿 J'ai calculé l'impact de ${formatNumber(qty)} kg de ${type} sur AgroLoopCI :

💰 Revenu potentiel : ${formatNumber(result.revenu)} FCFA
⚡ Énergie : ${formatNumber(result.energie)} kWh (≈ ${equivalentMaisons} foyer${equivalentMaisons > 1 ? "s" : ""}/an)
🌱 CO₂ évité : ${formatNumber(result.co2)} kg
♻️ Compost : ${formatNumber(result.compost)} kg

Calcule ton impact : ${typeof window !== "undefined" ? window.location.origin : ""}/calculateur`;

    if (navigator.share) {
      try { await navigator.share({ title: "Mon impact AgroLoopCI", text: msg }); } catch {}
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(msg);
      toast({ description: "✓ Texte copié dans le presse-papiers" });
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Calculateur de valorisation</h1>
          <p className="text-sm text-muted-foreground">Estimez le potentiel économique et environnemental de vos résidus.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Vos résidus</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Type de résidu agricole</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="select-calc-type"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Quantité (kg)</label>
            <Input
              type="number"
              min="0"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              placeholder="Ex: 1000"
              data-testid="input-calc-quantite"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <ResultCard
          icon={<Coins className="h-6 w-6" />}
          title="Revenu potentiel"
          value={`${formatNumber(result.revenu)} FCFA`}
          hint={`Basé sur ${f.revenu} FCFA/kg en moyenne pour ${type}`}
          color="from-amber-50 to-orange-50 border-amber-200 text-amber-900"
          testId="card-result-revenu"
        />
        <ResultCard
          icon={<Zap className="h-6 w-6" />}
          title="Énergie produite"
          value={`${formatNumber(result.energie)} kWh`}
          hint={`≈ ${equivalentMaisons} foyer${equivalentMaisons > 1 ? "s" : ""} alimenté${equivalentMaisons > 1 ? "s" : ""} pendant un an`}
          color="from-blue-50 to-cyan-50 border-blue-200 text-blue-900"
          testId="card-result-energie"
        />
        <ResultCard
          icon={<Leaf className="h-6 w-6" />}
          title="CO₂ évité"
          value={`${formatNumber(result.co2)} kg`}
          hint={`≈ ${equivalentVoitures} voiture${equivalentVoitures > 1 ? "s" : ""}/an retirée${equivalentVoitures > 1 ? "s" : ""} de la route`}
          color="from-green-50 to-emerald-50 border-green-200 text-green-900"
          testId="card-result-co2"
        />
        <ResultCard
          icon={<Recycle className="h-6 w-6" />}
          title="Compost obtenu"
          value={`${formatNumber(result.compost)} kg`}
          hint="Compost valorisable pour amender les sols agricoles"
          color="from-lime-50 to-green-50 border-lime-200 text-lime-900"
          testId="card-result-compost"
        />
      </div>

      <Card className="bg-primary/5 border-primary/30">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-sm">Partagez votre impact</div>
            <div className="text-xs text-muted-foreground">Inspirez d'autres producteurs à valoriser leurs résidus.</div>
          </div>
          <Button onClick={onShare} className="gap-2" data-testid="button-share-impact">
            📤 Partager
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Estimations indicatives basées sur des moyennes sectorielles en Côte d'Ivoire. Les résultats réels dépendent de la qualité, du conditionnement et du procédé de valorisation.
      </p>
    </div>
  );
}

function ResultCard({ icon, title, value, hint, color, testId }: { icon: React.ReactNode; title: string; value: string; hint: string; color: string; testId?: string }) {
  return (
    <Card className={`bg-gradient-to-br ${color} border`} data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="text-xs font-medium uppercase tracking-wide opacity-80">{title}</div>
          <div className="opacity-70">{icon}</div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs mt-1 opacity-80">{hint}</div>
      </CardContent>
    </Card>
  );
}
