import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Eye } from "lucide-react";
import { Link } from "wouter";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const STATUSES = ["all", "généré", "signé_vendeur", "signé_acheteur", "signé_les_deux", "annulé"];

export default function AdminContracts() {
  const [status, setStatus] = useState("all");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-contracts", status],
    queryFn: () => customFetch<any>(`/api/admin/contracts${status !== "all" ? `?status=${encodeURIComponent(status)}` : ""}`),
  });

  return (
    <AdminLayout title="Bons de commande">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold" data-testid="stat-total">{data?.stats?.total ?? "—"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Ce mois</div><div className="text-2xl font-bold" data-testid="stat-mois">{data?.stats?.ce_mois ?? "—"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Taux signature</div><div className="text-2xl font-bold" data-testid="stat-signature">{data ? `${Math.round((data.stats.taux_signature || 0) * 100)}%` : "—"}</div></CardContent></Card>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Statut :</span>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "Tous" : s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading && <div className="p-6"><Skeleton className="h-48 w-full" /></div>}
          {!isLoading && (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-3">Référence</th>
                  <th className="p-3">Tx</th>
                  <th className="p-3">Vendeur</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Montant</th>
                  <th className="p-3">Signatures</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.contracts.map((c: any) => (
                  <tr key={c.id} className="border-t" data-testid={`row-contract-${c.id}`}>
                    <td className="p-3 font-mono">{c.reference}</td>
                    <td className="p-3">#{c.transaction_id}</td>
                    <td className="p-3">{c.seller_name}</td>
                    <td className="p-3">{c.type_residu}</td>
                    <td className="p-3 text-right">{c.transaction ? fmt(c.transaction.total_fcfa) : "—"} FCFA</td>
                    <td className="p-3"><Badge variant="outline">{c.status}</Badge></td>
                    <td className="p-3 whitespace-nowrap">{new Date(c.generated_at).toLocaleDateString("fr-FR")}</td>
                    <td className="p-3 flex gap-1">
                      <Button asChild size="sm" variant="ghost"><Link href={`/transactions/${c.transaction_id}`}><Eye className="h-4 w-4" /></Link></Button>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        const token = localStorage.getItem("agroloop_token");
                        const r = await fetch(`/api/contracts/${c.transaction_id}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                        if (!r.ok) return;
                        const blob = await r.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href = url; a.download = `AgroLoopCI_${c.reference}.pdf`;
                        document.body.appendChild(a); a.click(); a.remove();
                        setTimeout(() => URL.revokeObjectURL(url), 5000);
                      }}><Download className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
                {data?.contracts.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Aucun bon de commande</td></tr>}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
