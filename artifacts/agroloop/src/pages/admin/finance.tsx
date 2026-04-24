import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Repeat,
  LineChart as LineChartIcon,
  Crown,
  Briefcase,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
import { subscriptionsApi } from "@/lib/subscriptions-api";

const FCFA = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const PCT = (n: number) => `${(n * 100).toFixed(1)} %`;

const PRIMARY = "#16a34a";
const PRIMARY_LIGHT = "#86efac";
const FORECAST = "#94a3b8";
const ORANGE = "#ea580c";
const BUSINESS = "#0ea5e9";

function formatMonthShort(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

export default function AdminFinancePage() {
  const [months, setMonths] = useState<string>("12");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-finance-metrics", months],
    queryFn: () => subscriptionsApi.adminFinanceMetrics(Number(months)),
  });

  const mrrChartData = (() => {
    if (!data) return [];
    const histo = data.mrr_series.map(p => ({
      month: formatMonthShort(p.month),
      mrr: p.mrr_total,
      mrr_pro: p.mrr_pro,
      mrr_business: p.mrr_business,
      forecast: null as number | null,
    }));
    const lastReal = histo[histo.length - 1];
    const fc = data.forecast.map((p, i) => ({
      month: formatMonthShort(p.month),
      mrr: null as number | null,
      mrr_pro: 0,
      mrr_business: 0,
      forecast: p.mrr_total,
      // Connect the dashed forecast to the last real point.
      ...(i === 0 && lastReal ? { forecast_link: lastReal.mrr } : {}),
    }));
    // Inject a connector point so the dashed line visually attaches to the last solid point.
    if (lastReal) {
      lastReal.forecast = lastReal.mrr;
    }
    return [...histo, ...fc];
  })();

  const churnChartData = data?.churn_series.map(p => ({
    month: formatMonthShort(p.month),
    churn_pct: Number((p.churn_rate * 100).toFixed(2)),
    cancelled: p.cancelled,
  })) ?? [];

  const summary = data?.summary;
  const mom = summary?.mrr_mom_growth ?? 0;
  const isGrowing = mom >= 0;

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-finance">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Finance</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Revenus récurrents, attrition et valeur vie client par segment.
            </p>
          </div>
          <Select value={months} onValueChange={setMonths}>
            <SelectTrigger className="w-[160px]" data-testid="filter-months"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6 derniers mois</SelectItem>
              <SelectItem value="12">12 derniers mois</SelectItem>
              <SelectItem value="24">24 derniers mois</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ===== KPI CARDS ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-none shadow-sm ring-1 ring-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">MRR ce mois</CardTitle>
              <LineChartIcon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-32" /> : (
                <>
                  <div className="text-2xl font-bold" data-testid="kpi-mrr">{FCFA(summary?.mrr_current ?? 0)} FCFA</div>
                  <div className={`text-xs mt-1 flex items-center gap-1 ${isGrowing ? "text-primary" : "text-orange-600"}`}>
                    {isGrowing ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {PCT(mom)} vs mois précédent
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm ring-1 ring-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Abonnés actifs</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <>
                  <div className="text-2xl font-bold" data-testid="kpi-active">{summary?.total_active ?? 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Pro {data?.segments.pro.active ?? 0} · Business {data?.segments.business.active ?? 0}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm ring-1 ring-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Churn moyen (3 mois)</CardTitle>
              <Repeat className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-20" /> : (
                <>
                  <div className="text-2xl font-bold" data-testid="kpi-churn">{PCT(summary?.avg_churn_rate ?? 0)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(summary?.avg_churn_rate ?? 0) === 0 ? "Aucune attrition mesurée" : "Attrition mensuelle"}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm ring-1 ring-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">LTV moyenne</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-32" /> : (
                <>
                  <div className="text-2xl font-bold" data-testid="kpi-ltv">{FCFA(summary?.total_ltv_weighted ?? 0)} FCFA</div>
                  <div className="text-xs text-muted-foreground mt-1">Pondérée par segment</div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== MRR + FORECAST CHART ===== */}
        <Card className="border-none shadow-sm ring-1 ring-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <LineChartIcon className="h-4 w-4 text-primary" />
              Évolution du MRR
              <Badge variant="outline" className="ml-2 font-normal text-xs">
                Prévision pointillée — régression linéaire 6 mois
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={mrrChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: any) => v == null ? "—" : `${FCFA(Number(v))} FCFA`}
                      labelStyle={{ color: "#0f172a" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="mrr"
                      name="MRR réalisé"
                      stroke={PRIMARY}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      name="Prévision (3 mois)"
                      stroke={FORECAST}
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== CHURN CHART ===== */}
        <Card className="border-none shadow-sm ring-1 ring-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Repeat className="h-4 w-4 text-orange-600" />
              Taux d'attrition mensuel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : churnChartData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Données insuffisantes</div>
            ) : (
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={churnChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v} %`} />
                    <ReferenceLine y={5} stroke={ORANGE} strokeDasharray="3 3" label={{ value: "Seuil 5%", fontSize: 10, fill: ORANGE, position: "right" }} />
                    <Bar dataKey="churn_pct" name="Churn (%)" fill={ORANGE} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== SEGMENT BREAKDOWN ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SegmentCard
            title="Segment Pro"
            icon={<Crown className="h-4 w-4" />}
            color={PRIMARY}
            data={data?.segments.pro}
            isLoading={isLoading}
          />
          <SegmentCard
            title="Segment Business"
            icon={<Briefcase className="h-4 w-4" />}
            color={BUSINESS}
            data={data?.segments.business}
            isLoading={isLoading}
          />
        </div>

        {/* ===== MRR SPLIT (Pro vs Business stacked bars) ===== */}
        <Card className="border-none shadow-sm ring-1 ring-border/50">
          <CardHeader>
            <CardTitle className="text-base">Répartition MRR par segment</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={mrrChartData.filter(p => p.mrr != null)} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${FCFA(v)} FCFA`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="mrr_pro" stackId="a" name="Pro" fill={PRIMARY_LIGHT} />
                    <Bar dataKey="mrr_business" stackId="a" name="Business" fill={BUSINESS} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function SegmentCard({
  title,
  icon,
  color,
  data,
  isLoading,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  data: { active: number; mrr: number; arpu: number; ltv: number; lifetime_months: number } | undefined;
  isLoading: boolean;
}) {
  return (
    <Card className="border-none shadow-sm ring-1 ring-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2" style={{ color }}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Stat label="Abonnés actifs" value={String(data.active)} />
            <Stat label="ARPU mensuel" value={`${FCFA(data.arpu)} FCFA`} />
            <Stat label="MRR" value={`${FCFA(data.mrr)} FCFA`} />
            <Stat label="LTV estimée" value={`${FCFA(data.ltv)} FCFA`} hint={`≈ ${data.lifetime_months} mois`} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-bold text-base">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
