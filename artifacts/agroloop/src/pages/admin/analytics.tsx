import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { customFetch } from "@workspace/api-client-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend, FunnelChart, Funnel, LabelList,
} from "recharts";
import {
  Eye, FileText, Users, Package, TrendingUp, TrendingDown,
  Monitor, Smartphone, Tablet, ExternalLink, Download,
  RefreshCw, BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = {
  green: "#16a34a",
  blue: "#2563eb",
  amber: "#d97706",
  gray: "#6b7280",
  red: "#dc2626",
};

type Period = "today" | "week" | "month";

// ─── HELPERS ────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(n);
}

function pctLabel(pct: number | undefined | null): string {
  if (pct == null) return "";
  return `${pct}%`;
}

// ─── REAL-TIME WIDGET ────────────────────────────────────────────────────────

function RealtimeWidget() {
  const { data, refetch } = useQuery({
    queryKey: ["analytics-realtime"],
    queryFn: () => customFetch<any>("/api/admin/analytics/realtime"),
    refetchInterval: 30_000,
  });

  return (
    <Card className="border-green-200 bg-green-50/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
            <span className="text-sm font-medium text-green-800">
              {data ? `${data.active_visitors} visiteur${data.active_visitors !== 1 ? "s" : ""} actif${data.active_visitors !== 1 ? "s" : ""} en ce moment` : "Chargement..."}
            </span>
          </div>
          {data?.top_pages?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {data.top_pages.map((p: any) => (
                <span key={p.path} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  {p.path} <span className="font-medium">({p.count})</span>
                </span>
              ))}
            </div>
          )}
          <button onClick={() => refetch()} className="text-xs text-green-600 flex items-center gap-1 hover:text-green-700">
            <RefreshCw className="h-3 w-3" /> Actualiser
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── KPI CARD ────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  change,
  loading,
}: {
  icon: any;
  label: string;
  value: string;
  change?: string | null;
  loading?: boolean;
}) {
  if (loading) return <Card><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>;

  const isPositive = change?.startsWith("+");
  const isNegative = change?.startsWith("-");

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 p-2 rounded-md mt-0.5 shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold mt-0.5">{value}</div>
            {change && (
              <div className={cn(
                "text-xs flex items-center gap-0.5 mt-0.5",
                isPositive ? "text-green-600" : isNegative ? "text-red-500" : "text-muted-foreground"
              )}>
                {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : null}
                {change} vs mois précédent
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── FUNNEL CHART ────────────────────────────────────────────────────────────

function ConversionFunnel({ data }: { data: any }) {
  const steps = [
    { name: "Visiteurs", value: data?.visitors ?? 0, pct: 100, color: COLORS.green },
    { name: "Inscrits", value: data?.registered ?? 0, pct: data?.pct_registered ?? 0, color: "#22c55e" },
    { name: "1er contact", value: data?.first_contact ?? 0, pct: data?.pct_first_contact ?? 0, color: COLORS.amber },
    { name: "Transaction", value: data?.first_transaction ?? 0, pct: data?.pct_first_transaction ?? 0, color: "#f97316" },
    { name: "Abonnement", value: data?.subscription ?? 0, pct: data?.pct_subscription ?? 0, color: COLORS.red },
  ];

  const max = steps[0].value || 1;

  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={step.name} className="flex items-center gap-3">
          <div className="w-24 text-xs text-muted-foreground text-right shrink-0">{step.name}</div>
          <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
            <div
              className="h-full rounded-full flex items-center px-2 transition-all duration-500"
              style={{
                width: `${Math.max((step.value / max) * 100, 2)}%`,
                backgroundColor: step.color,
                opacity: 1 - i * 0.1,
              }}
            >
              <span className="text-white text-xs font-medium whitespace-nowrap">{fmt(step.value)}</span>
            </div>
          </div>
          <div className="w-12 text-xs text-muted-foreground text-right shrink-0">{step.pct}%</div>
          {i > 0 && (
            <div className="w-20 text-xs text-red-400 shrink-0">
              drop: {100 - step.pct}%
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

export default function AdminAnalytics() {
  const [period, setPeriod] = useState<Period>("month");
  const [trafficDays, setTrafficDays] = useState(30);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: () => customFetch<any>("/api/admin/analytics/overview"),
  });

  const { data: traffic, isLoading: trafficLoading } = useQuery({
    queryKey: ["analytics-traffic", trafficDays],
    queryFn: () => customFetch<any>(`/api/admin/analytics/traffic?period=${trafficDays}`),
  });

  const periodData = overview?.[period];

  // Devices pie data
  const devicesData = overview?.devices
    ? [
        { name: "Mobile", value: overview.devices.mobile ?? 0, color: COLORS.green },
        { name: "Desktop", value: overview.devices.desktop ?? 0, color: COLORS.blue },
        { name: "Tablette", value: overview.devices.tablet ?? 0, color: COLORS.gray },
      ]
    : [];

  // By hour
  const hourData = Array.from({ length: 24 }, (_, h) => {
    const found = overview?.by_hour?.find((r: any) => r.hour === h);
    return { hour: `${String(h).padStart(2, "0")}h`, visitors: found?.visitors ?? 0 };
  });
  const maxHourVisitors = Math.max(...hourData.map((d) => d.visitors), 1);

  function exportCSV() {
    if (!overview) return;
    const rows = [
      ["Métrique", "Aujourd'hui", "7 jours", "30 jours"],
      ["Visiteurs", overview.today?.visitors, overview.week?.visitors, overview.month?.visitors],
      ["Pages vues", overview.today?.page_views, overview.week?.page_views, overview.month?.page_views],
      ["Nouveaux inscrits", overview.today?.new_users, overview.week?.new_users, overview.month?.new_users],
      ["Offres vues", overview.today?.offers_viewed, overview.week?.offers_viewed, overview.month?.offers_viewed],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics_agroloopci_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Analytics</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(["today", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                  period === p
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {p === "today" ? "Aujourd'hui" : p === "week" ? "7 jours" : "30 jours"}
              </button>
            ))}
          </div>
        </div>

        {/* Real-time */}
        <RealtimeWidget />

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={Eye}
            label="Visiteurs"
            value={fmt(periodData?.visitors)}
            change={period === "month" ? overview?.vs_last_period?.visitors_change : undefined}
            loading={overviewLoading}
          />
          <KpiCard
            icon={FileText}
            label="Pages vues"
            value={fmt(periodData?.page_views)}
            loading={overviewLoading}
          />
          <KpiCard
            icon={Users}
            label="Nouveaux inscrits"
            value={fmt(periodData?.new_users)}
            change={period === "month" ? overview?.vs_last_period?.users_change : undefined}
            loading={overviewLoading}
          />
          <KpiCard
            icon={Package}
            label="Offres vues"
            value={fmt(periodData?.offers_viewed)}
            loading={overviewLoading}
          />
        </div>

        {/* Traffic Chart */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Trafic sur la période</CardTitle>
            <div className="flex gap-1">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setTrafficDays(d)}
                  className={cn(
                    "text-xs px-2 py-1 rounded transition-colors",
                    trafficDays === d
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {d}j
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {trafficLoading ? (
              <Skeleton className="h-48" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={traffic ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPV" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v?.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(val: any, name: any) => [fmt(val), name === "visitors" ? "Visiteurs uniques" : name === "page_views" ? "Pages vues" : "Nouveaux inscrits"]}
                    labelFormatter={(l) => `Date : ${l}`}
                  />
                  <Area type="monotone" dataKey="visitors" stroke={COLORS.green} strokeWidth={2} fill="url(#colorVisitors)" name="visitors" />
                  <Area type="monotone" dataKey="page_views" stroke={COLORS.blue} strokeWidth={2} strokeDasharray="4 2" fill="url(#colorPV)" name="page_views" />
                  <Legend formatter={(v) => v === "visitors" ? "Visiteurs uniques" : v === "page_views" ? "Pages vues" : v} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 3-column row */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Devices */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Appareils</CardTitle></CardHeader>
            <CardContent>
              {overviewLoading ? <Skeleton className="h-40" /> : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={devicesData} dataKey="value" innerRadius={40} outerRadius={65} paddingAngle={2}>
                        {devicesData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [`${v}%`]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 mt-1">
                    {devicesData.map((d) => (
                      <div key={d.name} className="flex items-center gap-1 text-xs">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        {d.name} {d.value}%
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Top pages */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Pages populaires</CardTitle></CardHeader>
            <CardContent className="p-0">
              {overviewLoading ? <div className="p-4"><Skeleton className="h-40" /></div> : (
                <div className="divide-y text-sm">
                  {(overview?.top_pages ?? []).slice(0, 8).map((p: any) => {
                    const maxViews = overview?.top_pages?.[0]?.views ?? 1;
                    return (
                      <div key={p.path} className="px-4 py-2 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs truncate text-foreground">{p.path}</div>
                          <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-primary/60 rounded-full"
                              style={{ width: `${(p.views / maxViews) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs font-medium">{fmt(p.views)}</div>
                          <div className="text-[10px] text-muted-foreground">{fmt(p.unique)} uniques</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Regions */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Régions</CardTitle></CardHeader>
            <CardContent className="p-0">
              {overviewLoading ? <div className="p-4"><Skeleton className="h-40" /></div> : (
                <div className="divide-y text-sm">
                  {(overview?.by_region ?? []).slice(0, 8).map((r: any) => (
                    <div key={r.region} className="px-4 py-2 flex items-center justify-between gap-2">
                      <div className="truncate text-foreground">{r.region}</div>
                      <div className="shrink-0 flex gap-3 text-xs text-muted-foreground">
                        <span><span className="font-medium text-foreground">{fmt(r.users)}</span> utilisateurs</span>
                      </div>
                    </div>
                  ))}
                  {(!overview?.by_region || overview.by_region.length === 0) && (
                    <div className="px-4 py-6 text-center text-xs text-muted-foreground">Aucune donnée disponible</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Conversion Funnel */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Entonnoir de conversion</CardTitle></CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <ConversionFunnel data={overview?.conversion_funnel} />
            )}
          </CardContent>
        </Card>

        {/* Peak hours */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Activité par heure (30 derniers jours)</CardTitle></CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={hourData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={1} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(val: any) => [fmt(val), "Visiteurs"]}
                    labelFormatter={(l) => `Heure : ${l}`}
                  />
                  <Bar dataKey="visitors" radius={[3, 3, 0, 0]}>
                    {hourData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.visitors >= maxHourVisitors * 0.75 ? COLORS.green : entry.visitors >= maxHourVisitors * 0.4 ? "#4ade80" : "#bbf7d0"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top offers */}
        {overview?.top_offers?.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Offres les plus consultées</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y text-sm">
                {overview.top_offers.map((o: any, i: number) => (
                  <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{o.typeResidu}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs font-medium">{fmt(o.views)} vues</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* GA4 card + Export */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-blue-200 bg-blue-50/40">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 p-2 rounded-md shrink-0">
                  <BarChart2 className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">Google Analytics 4</div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Accédez à votre tableau de bord GA4 pour des analyses avancées : sources de trafic, comportement utilisateur, entonnoirs détaillés.
                  </p>
                  <a
                    href="https://analytics.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Ouvrir Google Analytics <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-primary/10 p-2 rounded-md shrink-0">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">Exporter le rapport</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Téléchargez les métriques actuelles au format CSV.
                </p>
                <button
                  onClick={exportCSV}
                  className="mt-2 text-xs bg-primary text-white px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors font-medium"
                >
                  Télécharger CSV
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
