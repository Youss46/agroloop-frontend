import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin-api";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Ban, ShieldCheck, Trash2, Search } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

const REGIONS = ["Abidjan", "Bouaké", "San-Pédro", "Korhogo", "Yamoussoukro", "Daloa", "Man", "Gagnoa"];

export default function AdminUsers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { hasPermission, isSuperAdmin } = useAuth();
  const canBan = hasPermission("users", "ban");
  const canDelete = hasPermission("users", "delete");
  const isSuperAdminTarget = (role?: string) => role === "super_admin" || role === "admin";
  const canActOn = (target: any) => isSuperAdmin || !isSuperAdminTarget(target?.role);
  const [filters, setFilters] = useState<any>({ page: 1 });
  const [banUser, setBanUser] = useState<any>(null);
  const [banReason, setBanReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", filters],
    queryFn: () => adminApi.listUsers(filters),
  });

  const ban = useMutation({
    mutationFn: ({ id, reason }: any) => adminApi.banUser(id, reason),
    onSuccess: () => { toast({ title: "Utilisateur banni" }); qc.invalidateQueries({ queryKey: ["admin-users"] }); setBanUser(null); setBanReason(""); },
  });
  const unban = useMutation({
    mutationFn: (id: number) => adminApi.unbanUser(id),
    onSuccess: () => { toast({ title: "Utilisateur réactivé" }); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });
  const del = useMutation({
    mutationFn: (id: number) => adminApi.deleteUser(id),
    onSuccess: () => { toast({ title: "Utilisateur supprimé" }); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });

  const setF = (k: string, v: any) => setFilters({ ...filters, [k]: v, page: 1 });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-6">Utilisateurs</h1>

      <Card className="mb-4">
        <CardContent className="p-4 grid md:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Rechercher nom/email"
              value={filters.search ?? ""}
              onChange={(e) => setF("search", e.target.value)}
              data-testid="input-user-search"
            />
          </div>
          <Select value={filters.role ?? "all"} onValueChange={(v) => setF("role", v === "all" ? undefined : v)}>
            <SelectTrigger><SelectValue placeholder="Rôle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les rôles</SelectItem>
              <SelectItem value="producteur">Producteur</SelectItem>
              <SelectItem value="transformateur">Transformateur</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.region ?? "all"} onValueChange={(v) => setF("region", v === "all" ? undefined : v)}>
            <SelectTrigger><SelectValue placeholder="Région" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les régions</SelectItem>
              {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.is_banned ?? "all"} onValueChange={(v) => setF("is_banned", v === "all" ? undefined : v)}>
            <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="false">Actifs</SelectItem>
              <SelectItem value="true">Bannis</SelectItem>
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
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-3">Nom</th><th className="p-3">Email</th><th className="p-3">Rôle</th>
                  <th className="p-3">Région</th><th className="p-3">Note</th><th className="p-3">Tx</th>
                  <th className="p-3">Statut</th><th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.users.map((u: any) => (
                  <tr key={u.id} className="border-t" data-testid={`row-user-${u.id}`}>
                    <td className="p-3 font-medium">{u.name}</td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
                    <td className="p-3"><Badge variant="outline">{u.role}</Badge></td>
                    <td className="p-3">{u.region ?? "—"}</td>
                    <td className="p-3">{u.ratingCount ? `${u.ratingAvg.toFixed(1)} ★ (${u.ratingCount})` : "—"}</td>
                    <td className="p-3">{u.totalTransactions}</td>
                    <td className="p-3">
                      {u.isBanned
                        ? <Badge variant="destructive">Banni</Badge>
                        : <Badge className="bg-green-600">Actif</Badge>}
                    </td>
                    <td className="p-3 flex gap-2">
                      {canBan && canActOn(u) && (
                        u.isBanned ? (
                          <Button size="sm" variant="outline" onClick={() => unban.mutate(u.id)} disabled={unban.isPending}>
                            <ShieldCheck className="h-4 w-4 mr-1" />Réactiver
                          </Button>
                        ) : (
                          <Dialog open={banUser?.id === u.id} onOpenChange={(o) => !o && setBanUser(null)}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" onClick={() => setBanUser(u)} data-testid={`btn-ban-${u.id}`}>
                                <Ban className="h-4 w-4 mr-1" />Bannir
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader><DialogTitle>Bannir {u.name}</DialogTitle></DialogHeader>
                              <Textarea placeholder="Motif du bannissement..." value={banReason} onChange={(e) => setBanReason(e.target.value)} />
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setBanUser(null)}>Annuler</Button>
                                <Button variant="destructive" onClick={() => ban.mutate({ id: u.id, reason: banReason })} disabled={ban.isPending}>
                                  Bannir
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )
                      )}
                      {canDelete && canActOn(u) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive" data-testid={`btn-delete-${u.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer {u.name} ?</AlertDialogTitle>
                              <AlertDialogDescription>Action irréversible. Toutes les données associées seront supprimées.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => del.mutate(u.id)}>Supprimer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {!canBan && !canDelete && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {(canBan || canDelete) && !canActOn(u) && (
                        <span className="text-xs text-muted-foreground italic">Protégé</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data?.users.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Aucun utilisateur</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-muted-foreground">{data?.total ?? 0} utilisateur(s)</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Précédent</Button>
          <span className="text-sm px-3 py-1">{filters.page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={filters.page >= totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Suivant</Button>
        </div>
      </div>
    </AdminLayout>
  );
}
