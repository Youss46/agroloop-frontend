import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, type AdminTeamMember, type AdminRoleDef, type AdminActivityEntry } from "@/lib/admin-api";
import { AdminLayout } from "@/components/admin-layout";
import { useAuth } from "@/components/auth-provider";
import { RoleBadge, ROLE_META } from "@/components/role-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, MoreVertical, RefreshCw, UserPlus, Copy, Activity, Trash2, ShieldOff, ShieldCheck, KeyRound, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROLES_ORDER = ["super_admin", "moderateur", "support", "finance", "commercial"];

function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const symbols = "!@#$%&*";
  let pw = "";
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  pw += symbols[Math.floor(Math.random() * symbols.length)];
  pw += Math.floor(Math.random() * 10);
  return pw;
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ActionLabel({ action }: { action: string }) {
  const map: Record<string, string> = {
    create_admin: "Création d'un administrateur",
    delete_admin: "Suppression d'un administrateur",
    activate_admin: "Activation d'un administrateur",
    deactivate_admin: "Désactivation d'un administrateur",
    change_admin_role: "Changement de rôle",
    user_ban: "Bannissement d'utilisateur",
    user_unban: "Réactivation d'utilisateur",
    user_delete: "Suppression d'utilisateur",
    offre_status: "Modération offre",
    offre_delete: "Suppression d'offre",
    verification_approve: "Vérification approuvée",
    verification_reject: "Vérification rejetée",
    broadcast: "Diffusion envoyée",
  };
  return <span>{map[action] ?? action}</span>;
}

function InviteDialog({ roles, onDone }: { roles: AdminRoleDef[]; onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(generatePassword());
  const [role, setRole] = useState<string>("moderateur");

  const inviteMut = useMutation({
    mutationFn: () => adminApi.team.invite({ name: name.trim(), email: email.trim(), password, role }),
    onSuccess: () => {
      toast({ title: "Invitation créée", description: `${name} a été ajouté à l'équipe.` });
      setName(""); setEmail(""); setPassword(generatePassword()); setRole("moderateur");
      setOpen(false);
      onDone();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message || "Échec de l'invitation", variant: "destructive" }),
  });

  const selectedRole = roles.find((r) => r.name === role);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="btn-invite-admin"><UserPlus className="h-4 w-4 mr-2" />Inviter un membre</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Inviter un membre de l'équipe</DialogTitle>
          <DialogDescription>
            Le nouveau compte recevra une notification interne et devra changer son mot de passe à la première connexion.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="invite-name">Nom complet</Label>
            <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Awa Diallo" data-testid="input-invite-name" />
          </div>
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="awa@agroloopci.com" data-testid="input-invite-email" />
          </div>
          <div>
            <Label htmlFor="invite-password">Mot de passe temporaire</Label>
            <div className="flex gap-2">
              <PasswordInput
                id="invite-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                containerClassName="flex-1"
                data-testid="input-invite-password"
              />
              <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())} title="Générer">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(password); toast({ title: "Copié" }); }} title="Copier">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Min. 8 caractères. À transmettre au nouveau membre par un canal sécurisé.</p>
          </div>
          <div>
            <Label>Rôle</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger data-testid="select-invite-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.filter((r) => ROLES_ORDER.includes(r.name)).sort((a, b) => ROLES_ORDER.indexOf(a.name) - ROLES_ORDER.indexOf(b.name)).map((r) => (
                  <SelectItem key={r.name} value={r.name}>
                    <span className="flex items-center gap-2">
                      <span>{ROLE_META[r.name]?.emoji}</span>
                      <span>{r.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRole?.description && (
              <p className="text-xs text-muted-foreground mt-2">{selectedRole.description}</p>
            )}
            {selectedRole && (
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.keys(selectedRole.permissions).map((res) => (
                  <Badge key={res} variant="secondary" className="text-[10px]">{res}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={() => inviteMut.mutate()} disabled={inviteMut.isPending} data-testid="btn-invite-submit">
            {inviteMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer le compte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangeRoleDialog({ member, roles, open, onOpenChange, onDone }: { member: AdminTeamMember | null; roles: AdminRoleDef[]; open: boolean; onOpenChange: (b: boolean) => void; onDone: () => void }) {
  const { toast } = useToast();
  const [newRole, setNewRole] = useState<string>(member?.role ?? "moderateur");
  useMemo(() => { if (member) setNewRole(member.role); }, [member]);
  const mut = useMutation({
    mutationFn: () => adminApi.team.changeRole(member!.id, newRole),
    onSuccess: () => {
      toast({ title: "Rôle modifié", description: `${member!.name} est maintenant ${ROLE_META[newRole]?.label ?? newRole}.` });
      onOpenChange(false); onDone();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message || "Échec", variant: "destructive" }),
  });
  if (!member) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Changer le rôle</DialogTitle>
          <DialogDescription>Modifier le rôle de <strong>{member.name}</strong></DialogDescription>
        </DialogHeader>
        <div>
          <Label>Nouveau rôle</Label>
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger data-testid="select-new-role"><SelectValue /></SelectTrigger>
            <SelectContent>
              {roles.filter((r) => ROLES_ORDER.includes(r.name)).sort((a, b) => ROLES_ORDER.indexOf(a.name) - ROLES_ORDER.indexOf(b.name)).map((r) => (
                <SelectItem key={r.name} value={r.name}>
                  <span className="flex items-center gap-2"><span>{ROLE_META[r.name]?.emoji}</span><span>{r.label}</span></span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {newRole !== member.role && (
            <p className="text-xs text-amber-600 mt-2">Le membre devra se reconnecter pour appliquer ses nouvelles permissions.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || newRole === member.role} data-testid="btn-change-role-submit">
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivityDialog({ member, open, onOpenChange }: { member: AdminTeamMember | null; open: boolean; onOpenChange: (b: boolean) => void }) {
  const { data, isLoading } = useQuery<AdminActivityEntry[]>({
    queryKey: ["admin-activity", member?.id],
    queryFn: () => adminApi.team.activity(member!.id),
    enabled: open && !!member,
  });
  if (!member) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Activité — {member.name}</DialogTitle>
          <DialogDescription>200 dernières actions enregistrées.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !data || data.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Aucune activité enregistrée.</p>
          ) : (
            <ul className="divide-y">
              {data.map((entry) => (
                <li key={entry.id} className="py-2.5 text-sm flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium"><ActionLabel action={entry.action} /></div>
                    {entry.target_type && (
                      <div className="text-xs text-muted-foreground">
                        Cible : {entry.target_type}{entry.target_id ? ` #${entry.target_id}` : ""}
                      </div>
                    )}
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <pre className="text-[11px] text-muted-foreground bg-muted/40 rounded mt-1 p-1.5 overflow-x-auto">{JSON.stringify(entry.details, null, 0)}</pre>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(entry.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminEquipePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filters, setFilters] = useState<{ q: string; role: string; status: string; page: number }>({ q: "", role: "all", status: "all", page: 1 });
  const params = {
    q: filters.q || undefined,
    role: filters.role !== "all" ? filters.role : undefined,
    status: filters.status !== "all" ? filters.status : undefined,
    page: filters.page,
    pageSize: 20,
  };
  const teamQ = useQuery({ queryKey: ["admin-team", params], queryFn: () => adminApi.team.list(params) });
  const rolesQ = useQuery<AdminRoleDef[]>({ queryKey: ["admin-roles"], queryFn: () => adminApi.team.roles() });
  const teamList: AdminTeamMember[] = teamQ.data?.admins ?? [];
  const total = teamQ.data?.total ?? 0;
  const pageSize = teamQ.data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [roleDlg, setRoleDlg] = useState<{ open: boolean; member: AdminTeamMember | null }>({ open: false, member: null });
  const [activityDlg, setActivityDlg] = useState<{ open: boolean; member: AdminTeamMember | null }>({ open: false, member: null });
  const [confirm, setConfirm] = useState<{ kind: "deactivate" | "activate" | "delete"; member: AdminTeamMember } | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-team"] });

  const actionMut = useMutation({
    mutationFn: async () => {
      if (!confirm) return;
      const { kind, member } = confirm;
      if (kind === "deactivate") return adminApi.team.deactivate(member.id);
      if (kind === "activate") return adminApi.team.activate(member.id);
      if (kind === "delete") return adminApi.team.remove(member.id);
    },
    onSuccess: () => {
      toast({ title: "Action effectuée" });
      setConfirm(null);
      refresh();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message || "Échec", variant: "destructive" }),
  });

  const stats = useMemo(() => {
    const active = teamList.filter((m) => m.is_admin_active).length;
    const byRole: Record<string, number> = {};
    for (const m of teamList) {
      const k = m.admin_role?.name ?? m.role;
      byRole[k] = (byRole[k] ?? 0) + 1;
    }
    return { total, active, byRole };
  }, [teamList, total]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Équipe administrative</h1>
            <p className="text-muted-foreground text-sm">Gérez les comptes administrateurs, leurs rôles et permissions.</p>
          </div>
          {rolesQ.data && <InviteDialog roles={rolesQ.data} onDone={refresh} />}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground">Actifs (page)</div>
            <div className="text-2xl font-bold mt-1 text-green-600">{stats.active}</div>
          </div>
          {ROLES_ORDER.slice(0, 2).map((r) => (
            <div key={r} className="rounded-lg border bg-card p-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">{ROLE_META[r]?.emoji} {ROLE_META[r]?.label} (page)</div>
              <div className="text-2xl font-bold mt-1">{stats.byRole[r] ?? 0}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-card p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Rechercher nom ou email"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))}
              data-testid="input-team-search"
            />
          </div>
          <Select value={filters.role} onValueChange={(v) => setFilters((f) => ({ ...f, role: v, page: 1 }))}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Rôle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les rôles</SelectItem>
              {ROLES_ORDER.map((r) => (
                <SelectItem key={r} value={r}>{ROLE_META[r]?.emoji} {ROLE_META[r]?.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v, page: 1 }))}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="inactive">Désactivés</SelectItem>
            </SelectContent>
          </Select>
          {(filters.q || filters.role !== "all" || filters.status !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => setFilters({ q: "", role: "all", status: "all", page: 1 })}>
              Réinitialiser
            </Button>
          )}
        </div>

        <div className="rounded-lg border bg-card overflow-x-auto">
          {teamQ.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membre</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead>Ajouté par</TableHead>
                  <TableHead>Ajouté le</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamList.map((m) => {
                  const isSelf = user?.id === m.id;
                  return (
                    <TableRow key={m.id} data-testid={`team-row-${m.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                            {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                          </div>
                          <div>
                            <div className="font-medium">{m.name} {isSelf && <span className="text-xs text-muted-foreground">(vous)</span>}</div>
                            <div className="text-xs text-muted-foreground">{m.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><RoleBadge role={m.role} /></TableCell>
                      <TableCell>
                        {m.is_admin_active ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Actif</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Désactivé</Badge>
                        )}
                        {m.force_password_change && (
                          <Badge variant="outline" className="ml-1 bg-amber-50 text-amber-700 border-amber-200">
                            <KeyRound className="h-3 w-3 mr-1" />Mot de passe à changer
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(m.last_login)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.created_by_name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(m.created_at)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isSelf} data-testid={`team-actions-${m.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setRoleDlg({ open: true, member: m })}>
                              Changer le rôle
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setActivityDlg({ open: true, member: m })}>
                              <Activity className="h-4 w-4 mr-2" />Voir l'activité
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {m.is_admin_active ? (
                              <DropdownMenuItem onClick={() => setConfirm({ kind: "deactivate", member: m })} className="text-amber-700">
                                <ShieldOff className="h-4 w-4 mr-2" />Désactiver
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => setConfirm({ kind: "activate", member: m })} className="text-green-700">
                                <ShieldCheck className="h-4 w-4 mr-2" />Réactiver
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setConfirm({ kind: "delete", member: m })} className="text-red-700">
                              <Trash2 className="h-4 w-4 mr-2" />Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">{total} membre(s)</span>
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))} data-testid="btn-team-prev">Précédent</Button>
            <span className="text-sm px-3 py-1">{filters.page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={filters.page >= totalPages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))} data-testid="btn-team-next">Suivant</Button>
          </div>
        </div>
      </div>

      <ChangeRoleDialog
        member={roleDlg.member}
        roles={rolesQ.data ?? []}
        open={roleDlg.open}
        onOpenChange={(b) => setRoleDlg((s) => ({ ...s, open: b }))}
        onDone={refresh}
      />
      <ActivityDialog
        member={activityDlg.member}
        open={activityDlg.open}
        onOpenChange={(b) => setActivityDlg((s) => ({ ...s, open: b }))}
      />

      <AlertDialog open={!!confirm} onOpenChange={(b) => !b && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "deactivate" && "Désactiver ce compte ?"}
              {confirm?.kind === "activate" && "Réactiver ce compte ?"}
              {confirm?.kind === "delete" && "Supprimer définitivement ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "deactivate" && `${confirm?.member.name} ne pourra plus se connecter à l'espace administrateur. Vous pourrez le réactiver à tout moment.`}
              {confirm?.kind === "activate" && `${confirm?.member.name} pourra de nouveau se connecter avec ses identifiants.`}
              {confirm?.kind === "delete" && `Le compte de ${confirm?.member.name} sera supprimé. Cette action est irréversible.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); actionMut.mutate(); }}
              disabled={actionMut.isPending}
              className={confirm?.kind === "delete" ? "bg-red-600 hover:bg-red-700" : ""}
              data-testid="confirm-action"
            >
              {actionMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
