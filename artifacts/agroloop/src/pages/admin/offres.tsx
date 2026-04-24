import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin-api";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2 } from "lucide-react";

const REGIONS = ["Abidjan", "Bouaké", "San-Pédro", "Korhogo", "Yamoussoukro", "Daloa", "Man", "Gagnoa"];

export default function AdminOffres() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<any>({ page: 1 });
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["admin-offres", filters],
    queryFn: () => adminApi.listOffres(filters),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: any) => adminApi.setOffreStatus(id, status),
    onSuccess: () => { toast({ title: "Statut mis à jour" }); qc.invalidateQueries({ queryKey: ["admin-offres"] }); },
  });
  const del = useMutation({
    mutationFn: (id: number) => adminApi.deleteOffre(id),
    onSuccess: () => { toast({ title: "Offre supprimée" }); qc.invalidateQueries({ queryKey: ["admin-offres"] }); },
  });
  const bulk = useMutation({
    mutationFn: ({ ids, action }: any) => adminApi.bulkOffres(ids, action),
    onSuccess: (r: any) => { toast({ title: `${r.count} offre(s) traitées` }); qc.invalidateQueries({ queryKey: ["admin-offres"] }); setSelected(new Set()); },
  });

  const setF = (k: string, v: any) => setFilters({ ...filters, [k]: v, page: 1 });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const toggle = (id: number) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-6">Offres</h1>

      <Card className="mb-4">
        <CardContent className="p-4 grid md:grid-cols-5 gap-3">
          <Input placeholder="Rechercher" value={filters.search ?? ""} onChange={(e) => setF("search", e.target.value)} />
          <Select value={filters.region ?? "all"} onValueChange={(v) => setF("region", v === "all" ? undefined : v)}>
            <SelectTrigger><SelectValue placeholder="Région" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status ?? "all"} onValueChange={(v) => setF("status", v === "all" ? undefined : v)}>
            <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="disponible">Disponible</SelectItem>
              <SelectItem value="vendu">Vendu</SelectItem>
              <SelectItem value="expiré">Expiré</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setFilters({ page: 1 })}>Réinitialiser</Button>
          {selected.size > 0 && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => bulk.mutate({ ids: [...selected], action: "expire" })}>
                Expirer ({selected.size})
              </Button>
              <Button size="sm" variant="destructive" onClick={() => bulk.mutate({ ids: [...selected], action: "delete" })}>
                Supprimer ({selected.size})
              </Button>
            </div>
          )}
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
                  <th className="p-3 w-8"></th>
                  <th className="p-3">Type</th><th className="p-3">Vendeur</th><th className="p-3">Région</th>
                  <th className="p-3">Quantité</th><th className="p-3">Prix</th><th className="p-3">Date</th>
                  <th className="p-3">Statut</th><th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.offres.map((o: any) => (
                  <tr key={o.id} className="border-t" data-testid={`row-offre-${o.id}`}>
                    <td className="p-3"><Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} /></td>
                    <td className="p-3 font-medium">{o.typeResidu}</td>
                    <td className="p-3">{o.sellerName}</td>
                    <td className="p-3">{o.region}</td>
                    <td className="p-3">{o.quantityKg} kg</td>
                    <td className="p-3">{o.priceFcfa.toLocaleString()} FCFA</td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("fr-FR")}</td>
                    <td className="p-3">
                      <Select value={o.status} onValueChange={(v) => setStatus.mutate({ id: o.id, status: v })}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="disponible">Disponible</SelectItem>
                          <SelectItem value="vendu">Vendu</SelectItem>
                          <SelectItem value="expiré">Expiré</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer cette offre ?</AlertDialogTitle>
                            <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => del.mutate(o.id)}>Supprimer</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </td>
                  </tr>
                ))}
                {data?.offres.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Aucune offre</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-muted-foreground">{data?.total ?? 0} offre(s)</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Précédent</Button>
          <span className="text-sm px-3 py-1">{filters.page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={filters.page >= totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Suivant</Button>
        </div>
      </div>
    </AdminLayout>
  );
}
