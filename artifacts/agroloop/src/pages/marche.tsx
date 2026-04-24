import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  TrendingDown, TrendingUp, Minus, BarChart3, Package, Calculator,
  ArrowUpRight, ArrowDownRight, Minus as Minus2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { marcheApi, type HistoriquePoint, type PrixActuel, type SyntheseItem } from "@/lib/marche-api";

const TYPES_RESIDUS = [
  "Cabosses de cacao",
  "Coques d'anacarde",
  "Tiges de plantain",
  "Coques de palmiste",
  "Rafles de palmier",
  "Feuilles de manioc",
  "Bois d'hévéa",
  "Coques de cacao",
  "Bagasse de canne",
  "Coques de café",
  "Tourteaux de coton",
  "Drêches de brasserie",
  "Pulpe de café",
  "Marc de café",
  "Sciure de bois",
  "Coques d'arachide",
  "Pailles de riz",
  "Tiges de manioc",
];

const REGIONS = [
  "Abidjan",
  "San Pedro",
  "Abengourou",
  "Bouaké",
  "Korhogo",
  "Yamoussoukro",
  "Soubré",
  "Gagnoa",
  "Divo",
  "Sassandra",
  "Mankono",
  "Daloa",
  "Autre",
];

const PERIODES = [
  { value: 30, label: "4 semaines" },
  { value: 90, label: "3 mois" },
  { value: 180, label: "6 mois" },
  { value: 365, label: "1 an" },
];

const formatNumber = (n: number) =>
  new Intl.NumberFormat("fr-CI").format(Math.round(n));

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-sm min-w-[180px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <p className="text-primary">Moy : {formatNumber(d.prixMoyen)} FCFA/kg</p>
      <p className="text-muted-foreground text-xs">Min : {formatNumber(d.prixMin)} FCFA</p>
      <p className="text-muted-foreground text-xs">Max : {formatNumber(d.prixMax)} FCFA</p>
      {d.volumeKg > 0 && (
        <p className="text-muted-foreground text-xs mt-1">Volume : {formatNumber(d.volumeKg)} kg</p>
      )}
      {d.nbTransactions > 0 && (
        <p className="text-muted-foreground text-xs">{d.nbTransactions} transaction{d.nbTransactions > 1 ? "s" : ""}</p>
      )}
    </div>
  );
}

function VarBadge({ pct }: { pct: number }) {
  if (pct > 1) {
    return (
      <span className="inline-flex items-center gap-0.5 text-orange-600 font-medium">
        <ArrowUpRight className="h-3 w-3" />
        +{pct.toFixed(1)}%
      </span>
    );
  }
  if (pct < -1) {
    return (
      <span className="inline-flex items-center gap-0.5 text-green-600 font-medium">
        <ArrowDownRight className="h-3 w-3" />
        {pct.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-muted-foreground">
      <Minus2 className="h-3 w-3" />
      stable
    </span>
  );
}

export default function Marche() {
  const [typeResidu, setTypeResidu] = useState<string>("Cabosses de cacao");
  const [region, setRegion] = useState<string>("all");
  const [periode, setPeriode] = useState<number>(90);

  const { data: hist, isLoading } = useQuery({
    queryKey: ["marche", "historique", typeResidu, region, periode],
    queryFn: () =>
      marcheApi.historique({
        type_residu: typeResidu,
        region: region === "all" ? undefined : region,
        periode,
      }),
  });

  const { data: prixActuels } = useQuery({
    queryKey: ["marche", "prix-actuels"],
    queryFn: () => marcheApi.prixActuels(),
  });

  const { data: syntheseData } = useQuery({
    queryKey: ["marche", "synthese"],
    queryFn: () => marcheApi.synthese(),
  });

  const chartData = useMemo(() => {
    return (hist?.series ?? []).map((p: HistoriquePoint) => ({
      semaine: new Date(p.semaine).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
      }),
      prixMoyen: Math.round(p.prixMoyen),
      prixMin: Math.round(p.prixMin),
      prixMax: Math.round(p.prixMax),
      volumeKg: Math.round(p.volumeKg),
      nbTransactions: p.nbTransactions,
    }));
  }, [hist]);

  const summary = hist?.summary;
  const variation = summary?.variationPct ?? 0;
  const VarIcon =
    variation > 1 ? TrendingUp : variation < -1 ? TrendingDown : Minus;
  const varColor =
    variation > 1
      ? "text-orange-600"
      : variation < -1
        ? "text-green-600"
        : "text-muted-foreground";

  const currentOfferPrice = useMemo(() => {
    return (
      prixActuels?.prixActuels?.find((p) => p.typeResidu === typeResidu)
        ?.prixMoyen ?? null
    );
  }, [prixActuels, typeResidu]);

  const insight = useMemo(() => {
    if (!summary || summary.nbTransactionsTotal === 0) return null;
    const v = summary.variationPct;
    if (v > 5) {
      return `📈 Le prix des ${typeResidu} est en hausse de ${v.toFixed(1)}% sur la période. C'est le bon moment pour vendre votre stock.`;
    }
    if (v < -5) {
      return `📉 Le prix des ${typeResidu} est en baisse de ${Math.abs(v).toFixed(1)}%. Les acheteurs peuvent négocier de bonnes conditions.`;
    }
    return `➡️ Le prix des ${typeResidu} est stable sur la période. ${formatNumber(summary.volumeTotal)} kg échangés sur ${summary.nbTransactionsTotal} transaction${summary.nbTransactionsTotal > 1 ? "s" : ""}.`;
  }, [summary, typeResidu]);

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Marché & Prix</h1>
            <p className="text-sm text-muted-foreground">
              Évolution des prix moyens des résidus agricoles en Côte d'Ivoire
            </p>
          </div>
        </div>
        <Link href="/calculateur">
          <Button
            variant="outline"
            className="gap-2"
            data-testid="button-link-calculator"
          >
            <Calculator className="h-4 w-4" /> Calculateur de valorisation
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Type de résidu agricole
            </label>
            <Select value={typeResidu} onValueChange={setTypeResidu}>
              <SelectTrigger data-testid="select-marche-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES_RESIDUS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Région
            </label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger data-testid="select-marche-region">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les régions</SelectItem>
                {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Période
            </label>
            <Select
              value={String(periode)}
              onValueChange={(v) => setPeriode(Number(v))}
            >
              <SelectTrigger data-testid="select-marche-periode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODES.map((p) => (
                  <SelectItem key={p.value} value={String(p.value)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          title="Prix moyen actuel"
          value={
            summary
              ? `${formatNumber(summary.prixMoyenActuel)} FCFA/kg`
              : isLoading
                ? null
                : "0 FCFA/kg"
          }
          loading={isLoading}
          testId="card-summary-prix"
        />
        <SummaryCard
          title="Variation sur la période"
          value={
            summary
              ? `${variation > 0 ? "+" : ""}${variation.toFixed(1)} %`
              : isLoading
                ? null
                : "0,0 %"
          }
          icon={
            summary ? (
              <VarIcon className={`h-5 w-5 ${varColor}`} />
            ) : undefined
          }
          loading={isLoading}
          valueClassName={summary ? varColor : undefined}
          testId="card-summary-variation"
        />
        <SummaryCard
          title="Volume total échangé"
          value={
            summary
              ? `${formatNumber(summary.volumeTotal)} kg`
              : isLoading
                ? null
                : "0 kg"
          }
          loading={isLoading}
          testId="card-summary-volume"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Évolution du prix moyen — {typeResidu}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center gap-4 text-center px-4">
              <p className="text-sm text-muted-foreground max-w-sm">
                📊 Les données de marché s'enrichissent à chaque transaction.
                Revenez bientôt ou explorez d'autres types de résidus.
              </p>
              <Link href="/marketplace">
                <Button variant="outline" size="sm">
                  Voir toutes les offres
                </Button>
              </Link>
            </div>
          ) : (
            <div className="h-72" data-testid="chart-prix-historique">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="semaine" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${formatNumber(v)} F`}
                    width={70}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {currentOfferPrice && (
                    <ReferenceLine
                      y={currentOfferPrice}
                      stroke="#94a3b8"
                      strokeDasharray="5 5"
                      label={{
                        value: "Prix offres actives",
                        position: "insideTopRight",
                        fontSize: 10,
                        fill: "#94a3b8",
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="prixMoyen"
                    stroke="#16a34a"
                    strokeWidth={2}
                    name="Prix moyen"
                    dot={{ r: 3, fill: "#16a34a" }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="prixMin"
                    stroke="#94a3b8"
                    strokeDasharray="3 3"
                    name="Min"
                    dot={{ r: 2, fill: "#94a3b8" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="prixMax"
                    stroke="#cbd5e1"
                    strokeDasharray="3 3"
                    name="Max"
                    dot={{ r: 2, fill: "#cbd5e1" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {insight && (
            <div className="mt-4 rounded-lg bg-muted/50 border px-4 py-3 text-sm text-muted-foreground">
              {insight}
            </div>
          )}
        </CardContent>
      </Card>

      {(syntheseData?.synthese ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Prix du marché actuel
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Basé sur les transactions des 30 derniers jours. Cliquez sur une
              ligne pour filtrer le graphique.
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type de résidu agricole</TableHead>
                  <TableHead className="text-right">Prix moy.</TableHead>
                  <TableHead className="text-right">Variation</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">
                    Volume (30j)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(syntheseData?.synthese ?? []).map((s: SyntheseItem) => (
                  <TableRow
                    key={s.typeResidu}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => setTypeResidu(s.typeResidu)}
                    data-testid={`row-synthese-${s.typeResidu}`}
                  >
                    <TableCell className="font-medium">
                      {s.typeResidu}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {formatNumber(s.prixMoyen)} FCFA
                    </TableCell>
                    <TableCell className="text-right">
                      <VarBadge pct={s.variationPct} />
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell text-muted-foreground">
                      {formatNumber(s.volumeKg)} kg
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" /> Offres actives sur le marché
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Résidu</TableHead>
                <TableHead className="text-right">Prix moyen (FCFA/kg)</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Min</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Max</TableHead>
                <TableHead className="text-right">Offres</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(prixActuels?.prixActuels ?? []).map((p: PrixActuel) => (
                <TableRow
                  key={p.typeResidu}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => setTypeResidu(p.typeResidu)}
                  data-testid={`row-prix-${p.typeResidu}`}
                >
                  <TableCell className="font-medium">{p.typeResidu}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">
                    {formatNumber(p.prixMoyen)}
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell text-muted-foreground">
                    {formatNumber(p.prixMin)}
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell text-muted-foreground">
                    {formatNumber(p.prixMax)}
                  </TableCell>
                  <TableCell className="text-right">{p.nbOffres}</TableCell>
                </TableRow>
              ))}
              {(!prixActuels?.prixActuels ||
                prixActuels.prixActuels.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-6"
                  >
                    Aucune offre disponible en ce moment.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  loading,
  valueClassName,
  testId,
}: {
  title: string;
  value: string | null;
  icon?: React.ReactNode;
  loading?: boolean;
  valueClassName?: string;
  testId?: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          {title}
        </div>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div className="flex items-center gap-2">
            <div className={`text-2xl font-bold ${valueClassName ?? ""}`}>
              {value ?? "0"}
            </div>
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
