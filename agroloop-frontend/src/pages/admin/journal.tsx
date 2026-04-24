import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin-api";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Download, ChevronDown, ChevronRight, Info } from "lucide-react";

type Severity = "info" | "warn" | "danger" | "success";

const ACTION_META: Record<string, { sev: Severity; emoji: string }> = {
  approve_verification: { sev: "success", emoji: "✓" },
  reject_verification: { sev: "danger", emoji: "✕" },
  ban_user: { sev: "danger", emoji: "🚫" },
  unban_user: { sev: "success", emoji: "🔓" },
  delete_offre: { sev: "danger", emoji: "🗑" },
  remove_flagged_offer: { sev: "danger", emoji: "🗑" },
  review_flagged_offer: { sev: "info", emoji: "👁" },
  flag_rating: { sev: "warn", emoji: "🚩" },
  unflag_rating: { sev: "info", emoji: "↩" },
  delete_rating: { sev: "danger", emoji: "🗑" },
  broadcast: { sev: "info", emoji: "📣" },
  approve_subscription: { sev: "success", emoji: "✓" },
  reject_subscription: { sev: "danger", emoji: "✕" },
  force_transaction_status: { sev: "warn", emoji: "⚙" },
  team_invite: { sev: "info", emoji: "➕" },
  team_change_role: { sev: "warn", emoji: "🔧" },
  team_deactivate: { sev: "warn", emoji: "⏸" },
  team_remove: { sev: "danger", emoji: "🗑" },
};

const SEV_CLS: Record<Severity, { pill: string; border: string }> = {
  info:    { pill: "bg-sky-100 text-sky-800 border-sky-300",          border: "border-l-sky-400" },
  warn:    { pill: "bg-amber-100 text-amber-800 border-amber-300",    border: "border-l-amber-400" },
  danger:  { pill: "bg-red-100 text-red-800 border-red-300",          border: "border-l-red-500" },
  success: { pill: "bg-emerald-100 text-emerald-800 border-emerald-300", border: "border-l-emerald-400" },
};

function actionInfo(a: string) {
  return ACTION_META[a] ?? { sev: "info" as Severity, emoji: "•" };
}

export default function AdminJournal() {
  const [filters, setFilters] = useState<any>({ page: 1 });
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const { data, isLoading } = useQuery({
    queryKey: ["admin-logs", filters],
    queryFn: () => adminApi.logs(filters),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const exportCsv = () => {
    if (!data?.logs?.length) return;
    const rows = [
      ["Date", "Admin", "Action", "Type cible", "ID cible", "Détails"],
      ...data.logs.map((l: any) => [
        new Date(l.createdAt).toISOString(),
        l.adminName ?? "",
        l.action ?? "",
        l.targetType ?? "",
        l.targetId ?? "",
        l.details ? JSON.stringify(l.details).replace(/"/g, '""') : "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Journal d'audit</h1>
        <Button variant="outline" onClick={exportCsv} disabled={!data?.logs?.length} data-testid="button-export-csv">
          <Download className="h-4 w-4 mr-2" /> Exporter CSV
        </Button>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900" data-testid="banner-journal-info">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Toutes les actions admin sensibles sont enregistrées ici. Cliquez sur une ligne pour afficher les détails complets.
          Les entrées sont conservées 12 mois pour audit interne.
        </span>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Rechercher admin, action ou détails"
              value={filters.search ?? ""}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              data-testid="input-log-search"
            />
          </div>
          <Select value={filters.target_type ?? "all"} onValueChange={(v) => setFilters({ ...filters, target_type: v === "all" ? undefined : v, page: 1 })}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Type de cible" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="user">Utilisateur</SelectItem>
              <SelectItem value="offre">Offre</SelectItem>
              <SelectItem value="transaction">Transaction</SelectItem>
              <SelectItem value="rating">Avis</SelectItem>
              <SelectItem value="broadcast">Diffusion</SelectItem>
              <SelectItem value="verification">Vérification</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            className="w-44"
            value={filters.from ?? ""}
            onChange={(e) => setFilters({ ...filters, from: e.target.value || undefined, page: 1 })}
            data-testid="input-from-date"
          />
          <Input
            type="date"
            className="w-44"
            value={filters.to ?? ""}
            onChange={(e) => setFilters({ ...filters, to: e.target.value || undefined, page: 1 })}
            data-testid="input-to-date"
          />
          <Button variant="outline" onClick={() => setFilters({ page: 1 })}>Réinitialiser</Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-3 w-10"></th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Admin</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Cible</th>
                </tr>
              </thead>
              <tbody>
                {data?.logs.map((l: any) => {
                  const meta = actionInfo(l.action);
                  const sev = SEV_CLS[meta.sev];
                  const isOpen = !!expanded[l.id];
                  return (
                    <Fragment key={l.id}>
                      <tr
                        className={`border-t hover:bg-muted/30 cursor-pointer border-l-4 ${sev.border}`}
                        onClick={() => setExpanded((p) => ({ ...p, [l.id]: !p[l.id] }))}
                        data-testid={`row-log-${l.id}`}
                      >
                        <td className="p-3 text-muted-foreground">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(l.createdAt).toLocaleString("fr-FR")}
                        </td>
                        <td className="p-3 font-medium">{l.adminName ?? "—"}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${sev.pill}`}>
                            <span>{meta.emoji}</span>{l.action}
                          </span>
                        </td>
                        <td className="p-3 text-xs">
                          <span className="text-muted-foreground">{l.targetType}</span>
                          {l.targetId && <span className="font-mono ml-1">#{l.targetId}</span>}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/20 border-t border-l-4 border-l-transparent">
                          <td colSpan={5} className="p-4">
                            <div className="text-xs font-semibold mb-1 text-muted-foreground">Détails</div>
                            <pre className="font-mono text-xs whitespace-pre-wrap break-all bg-white rounded border p-3">
                              {l.details ? JSON.stringify(l.details, null, 2) : "Aucun détail"}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {data?.logs.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Aucune entrée</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-muted-foreground">{data?.total ?? 0} entrée(s)</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Précédent</Button>
          <span className="text-sm px-3 py-1">{filters.page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={filters.page >= totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Suivant</Button>
        </div>
      </div>
    </AdminLayout>
  );
}
