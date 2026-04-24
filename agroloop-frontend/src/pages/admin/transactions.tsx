import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin-api";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";

const STATUSES = ["en_attente", "confirmée", "annulée"];

export default function AdminTransactions() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<any>({ page: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tx", filters],
    queryFn: () => adminApi.listTransactions(filters),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: any) => adminApi.setTransactionStatus(id, status),
    onSuccess: () => { toast({ title: "Statut mis à jour" }); qc.invalidateQueries({ queryKey: ["admin-tx"] }); },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-6">Transactions</h1>

      {data && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Volume confirmé</div><div className="text-2xl font-bold">{fmt(data.totalVolumeFcfa)} FCFA</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Commission (4%)</div><div className="text-2xl font-bold text-primary">{fmt(data.commissionEstimee)} FCFA</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Ce mois</div><div className="text-2xl font-bold">{data.transactionsCeMois}</div></CardContent></Card>
        </div>
      )}

      <Card className="mb-4">
        <CardContent className="p-4 flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Rechercher type, région, vendeur, acheteur ou ID"
              value={filters.search ?? ""}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              data-testid="input-tx-search"
            />
          </div>
          <Select value={filters.status ?? "all"} onValueChange={(v) => setFilters({ ...filters, status: v === "all" ? undefined : v, page: 1 })}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setFilters({ page: 1 })}>Réinitialiser</Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr className="text-left">
                <th className="p-3">ID</th><th className="p-3">Type</th><th className="p-3">Vendeur</th>
                <th className="p-3">Acheteur</th><th className="p-3">Quantité</th><th className="p-3">Prix</th>
                <th className="p-3">Commission</th><th className="p-3">Date</th><th className="p-3">Statut</th>
              </tr></thead>
              <tbody>
                {data?.transactions.map((t: any) => (
                  <tr key={t.id} className="border-t" data-testid={`row-tx-${t.id}`}>
                    <td className="p-3 font-mono text-xs">#{t.id}</td>
                    <td className="p-3 font-medium">{t.typeResidu}</td>
                    <td className="p-3">{t.sellerName}</td>
                    <td className="p-3">{t.buyerName}</td>
                    <td className="p-3">{t.quantityKg} kg</td>
                    <td className="p-3">{t.priceFcfa.toLocaleString()} FCFA</td>
                    <td className="p-3 text-primary font-medium">{t.commission.toLocaleString()} FCFA</td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString("fr-FR")}</td>
                    <td className="p-3">
                      <Select value={t.status} onValueChange={(v) => setStatus.mutate({ id: t.id, status: v })}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
                {data?.transactions.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Aucune transaction</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-muted-foreground">{data?.total ?? 0} transaction(s)</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Précédent</Button>
          <span className="text-sm px-3 py-1">{filters.page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={filters.page >= totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Suivant</Button>
        </div>
      </div>
    </AdminLayout>
  );
}
