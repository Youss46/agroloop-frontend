import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ShieldAlert, KeyRound, UserPlus, Pencil, Trash2, Power, LogOut } from "lucide-react";

const TOKEN_STORAGE_KEY = "agroloop:dev-portal-token";

const ROLE_OPTIONS = [
  { value: "super_admin", label: "Super Administrateur" },
  { value: "admin", label: "Administrateur (legacy, accès complet)" },
  { value: "moderateur", label: "Modérateur" },
  { value: "support", label: "Support" },
  { value: "finance", label: "Finance" },
  { value: "commercial", label: "Commercial" },
];

const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

interface AdminRow {
  id: number;
  name: string;
  email: string;
  role: string;
  role_label: string | null;
  is_admin_active: boolean;
  is_banned: boolean;
  last_login: string | null;
  created_at: string;
  force_password_change: boolean;
}

async function devFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-dev-token": token,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = "Erreur";
    try {
      const j = await res.json();
      msg = j?.error ?? msg;
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function TokenGate({ onUnlock }: { onUnlock: (token: string) => void }) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-12rem)] px-4">
      <Card className="w-full max-w-md border-amber-300 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-2">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <CardTitle>Espace développeur</CardTitle>
          <CardDescription>
            Zone protégée — réservée à l'administration technique. Entrez le jeton développeur
            pour accéder à la gestion des comptes super-admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              if (!token) return;
              setLoading(true);
              try {
                await devFetch(token, "/api/dev/auth", { method: "POST", body: JSON.stringify({}) });
                sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
                onUnlock(token);
              } catch (err: any) {
                setError(err?.message ?? "Jeton invalide");
              } finally {
                setLoading(false);
              }
            }}
          >
            <div>
              <Label htmlFor="dev-token">Jeton développeur</Label>
              <Input
                id="dev-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="••••••••••••••"
                autoComplete="off"
                data-testid="input-dev-token"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-600" data-testid="text-dev-error">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-dev-unlock">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Déverrouiller
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

interface CreateForm {
  name: string;
  email: string;
  password: string;
  role: string;
}

interface EditState {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface PasswordState {
  id: number;
  email: string;
  password: string;
}

export default function DevPortalPage() {
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [resetting, setResetting] = useState<PasswordState | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [form, setForm] = useState<CreateForm>({ name: "", email: "", password: "", role: "super_admin" });

  useEffect(() => {
    const t = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!t) return;
    // Validate cached token; if invalid, clear it.
    devFetch(t, "/api/dev/auth", { method: "POST", body: JSON.stringify({}) })
      .then(() => setToken(t))
      .catch(() => sessionStorage.removeItem(TOKEN_STORAGE_KEY));
  }, []);

  async function refresh(t: string = token!) {
    setLoading(true);
    try {
      const data = await devFetch<{ admins: AdminRow[] }>(t, "/api/dev/admins");
      setAdmins(data.admins);
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Chargement impossible", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) refresh(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return <TokenGate onUnlock={(t) => setToken(t)} />;

  function handleLock() {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setAdmins([]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      await devFetch(token, "/api/dev/admins", { method: "POST", body: JSON.stringify(form) });
      toast({ title: "Administrateur créé", description: `${form.email} peut maintenant se connecter sur /login.` });
      setForm({ name: "", email: "", password: "", role: "super_admin" });
      setCreateOpen(false);
      refresh();
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Création impossible", variant: "destructive" });
    }
  }

  async function handleEditSave() {
    if (!token || !editing) return;
    try {
      await devFetch(token, `/api/dev/admins/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editing.name, email: editing.email, role: editing.role }),
      });
      toast({ title: "Compte mis à jour" });
      setEditing(null);
      refresh();
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Mise à jour impossible", variant: "destructive" });
    }
  }

  async function handlePasswordReset() {
    if (!token || !resetting) return;
    if (resetting.password.length < 8) {
      toast({ title: "Mot de passe trop court", description: "Minimum 8 caractères.", variant: "destructive" });
      return;
    }
    try {
      await devFetch(token, `/api/dev/admins/${resetting.id}/password`, {
        method: "PUT",
        body: JSON.stringify({ password: resetting.password }),
      });
      toast({
        title: "Mot de passe réinitialisé",
        description: `${resetting.email} doit se reconnecter avec le nouveau mot de passe.`,
      });
      setResetting(null);
      refresh();
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Échec", variant: "destructive" });
    }
  }

  async function toggleActive(row: AdminRow) {
    if (!token) return;
    setBusyId(row.id);
    try {
      await devFetch(token, `/api/dev/admins/${row.id}/active`, {
        method: "PUT",
        body: JSON.stringify({ active: !row.is_admin_active }),
      });
      toast({ title: row.is_admin_active ? "Compte suspendu" : "Compte réactivé" });
      refresh();
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Échec", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(row: AdminRow) {
    if (!token) return;
    if (!confirm(`Supprimer définitivement ${row.email} ? Cette action est irréversible.`)) return;
    setBusyId(row.id);
    try {
      await devFetch(token, `/api/dev/admins/${row.id}`, { method: "DELETE" });
      toast({ title: "Compte supprimé" });
      refresh();
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Échec", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Espace développeur</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Création et gestion des comptes administrateurs. Cette zone est protégée par un jeton secret.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateOpen(true)} data-testid="button-create-admin">
            <UserPlus className="h-4 w-4 mr-2" /> Nouveau compte admin
          </Button>
          <Button variant="outline" onClick={handleLock} data-testid="button-lock">
            <LogOut className="h-4 w-4 mr-2" /> Verrouiller
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comptes administrateurs ({admins.length})</CardTitle>
          <CardDescription>Tous les comptes ayant un rôle administrateur sur la plateforme.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Chargement...</p>
          ) : admins.length === 0 ? (
            <div className="text-center py-8" data-testid="empty-admins">
              <p className="text-sm text-muted-foreground mb-4">
                Aucun compte administrateur n'existe pour le moment.
              </p>
              <Button onClick={() => setCreateOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" /> Créer le premier super-admin
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Compte</th>
                    <th className="py-2 pr-3">Rôle</th>
                    <th className="py-2 pr-3">Statut</th>
                    <th className="py-2 pr-3">Dernière connexion</th>
                    <th className="py-2 pr-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id} className="border-b last:border-b-0" data-testid={`admin-row-${a.id}`}>
                      <td className="py-3 pr-3">
                        <div className="font-medium">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant="outline">{ROLE_LABEL[a.role] ?? a.role}</Badge>
                      </td>
                      <td className="py-3 pr-3">
                        {a.is_banned ? (
                          <Badge className="bg-red-100 text-red-800 border-none">Banni</Badge>
                        ) : a.is_admin_active ? (
                          <Badge className="bg-green-100 text-green-800 border-none">Actif</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-none">Suspendu</Badge>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground text-xs">{formatDate(a.last_login)}</td>
                      <td className="py-3 pr-3">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing({ id: a.id, name: a.name, email: a.email, role: a.role })}
                            data-testid={`button-edit-${a.id}`}
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setResetting({ id: a.id, email: a.email, password: "" })}
                            data-testid={`button-password-${a.id}`}
                            title="Réinitialiser le mot de passe"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleActive(a)}
                            disabled={busyId === a.id}
                            data-testid={`button-toggle-${a.id}`}
                            title={a.is_admin_active ? "Suspendre" : "Réactiver"}
                          >
                            <Power className={`h-4 w-4 ${a.is_admin_active ? "text-amber-600" : "text-green-600"}`} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(a)}
                            disabled={busyId === a.id}
                            data-testid={`button-delete-${a.id}`}
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-4">
        Astuce — accédez à <code className="bg-muted px-1 py-0.5 rounded">/admin</code> avec un compte créé ici pour ouvrir le panneau d'administration.
      </p>

      {/* Create modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un compte administrateur</DialogTitle>
            <DialogDescription>Le compte sera immédiatement actif et pourra se connecter sur /login.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <Label htmlFor="c-name">Nom complet</Label>
              <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="input-create-name" />
            </div>
            <div>
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required data-testid="input-create-email" />
            </div>
            <div>
              <Label htmlFor="c-password">Mot de passe (min. 8 caractères)</Label>
              <Input id="c-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} autoComplete="new-password" required data-testid="input-create-password" />
            </div>
            <div>
              <Label htmlFor="c-role">Rôle</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger id="c-role" data-testid="select-create-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
              <Button type="submit" data-testid="button-submit-create">Créer le compte</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le compte</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="e-name">Nom complet</Label>
                <Input id="e-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="e-email">Email</Label>
                <Input id="e-email" type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="e-role">Rôle</Label>
                <Select value={editing.role} onValueChange={(v) => setEditing({ ...editing, role: v })}>
                  <SelectTrigger id="e-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Changer le rôle déconnecte les sessions actives.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button onClick={handleEditSave}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password reset modal */}
      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              Définissez un nouveau mot de passe pour {resetting?.email}. Toutes les sessions actives seront révoquées.
            </DialogDescription>
          </DialogHeader>
          {resetting && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="r-password">Nouveau mot de passe (min. 8 caractères)</Label>
                <Input
                  id="r-password"
                  type="password"
                  value={resetting.password}
                  onChange={(e) => setResetting({ ...resetting, password: e.target.value })}
                  minLength={8}
                  autoComplete="new-password"
                  data-testid="input-reset-password"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetting(null)}>Annuler</Button>
            <Button onClick={handlePasswordReset} data-testid="button-submit-password">Réinitialiser</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
