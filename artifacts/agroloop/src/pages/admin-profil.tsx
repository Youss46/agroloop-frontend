import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type AdminRoleDef } from "@/lib/admin-api";
import { AdminLayout } from "@/components/admin-layout";
import { useAuth } from "@/components/auth-provider";
import { RoleBadge } from "@/components/role-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getGetMeQueryKey } from "@workspace/api-client-react";

const RESOURCE_LABELS: Record<string, string> = {
  users: "Utilisateurs",
  offres: "Offres",
  litiges: "Litiges",
  ratings: "Avis",
  reports: "Rapports",
  broadcast: "Diffusion",
  contracts: "Bons de commande",
  audit_logs: "Journal d'audit",
  transactions: "Transactions",
  subscriptions: "Abonnements",
  verifications: "Vérifications",
  admin_accounts: "Comptes admin",
  payment_settings: "Configuration paiement",
};

const ACTION_LABELS: Record<string, string> = {
  view: "Voir", edit: "Modifier", delete: "Supprimer", create: "Créer",
  ban: "Bannir", approve: "Approuver", reject: "Rejeter", flag: "Signaler",
  send: "Envoyer", export: "Exporter",
};

export default function AdminProfilPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState(user?.name ?? "");
  useEffect(() => { if (user?.name) setName(user.name); }, [user?.name]);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const rolesQ = useQuery<AdminRoleDef[]>({ queryKey: ["admin-roles"], queryFn: () => adminApi.team.roles() });
  const myRoleDef = rolesQ.data?.find((r) => r.name === user?.role);
  const permissions = (user as any)?.permissions ?? myRoleDef?.permissions ?? {};

  const nameMut = useMutation({
    mutationFn: () => adminApi.profile.update({ name: name.trim() }),
    onSuccess: () => {
      toast({ title: "Profil mis à jour" });
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message || "Échec", variant: "destructive" }),
  });

  const pwdMut = useMutation({
    mutationFn: () => adminApi.profile.changePassword({ current_password: currentPwd, new_password: newPwd }),
    onSuccess: () => {
      toast({ title: "Mot de passe modifié" });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message || "Échec", variant: "destructive" }),
  });

  const submitPwd = () => {
    if (newPwd.length < 8) { toast({ title: "Trop court", description: "Min. 8 caractères", variant: "destructive" }); return; }
    if (newPwd !== confirmPwd) { toast({ title: "Les mots de passe ne correspondent pas", variant: "destructive" }); return; }
    pwdMut.mutate();
  };

  if (!user) return null;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">Mon profil</h1>
          <p className="text-muted-foreground text-sm">Gérez vos informations personnelles et votre mot de passe.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Identité</CardTitle>
            <CardDescription>Vos informations de compte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-medium">
                {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
              <div>
                <RoleBadge role={user.role as string} />
                {myRoleDef?.description && <p className="text-xs text-muted-foreground mt-1">{myRoleDef.description}</p>}
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="profile-name">Nom complet</Label>
                <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-profile-name" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={user.email} disabled />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Dernière connexion : </span>{(user as any).lastLogin ? new Date((user as any).lastLogin).toLocaleString("fr-FR") : "—"}</div>
              <div><span className="text-muted-foreground">Statut : </span>{(user as any).isAdminActive === false ? <Badge variant="destructive">Désactivé</Badge> : <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Actif</Badge>}</div>
            </div>
            <div>
              <Button onClick={() => nameMut.mutate()} disabled={nameMut.isPending || !name.trim() || name === user.name} data-testid="btn-save-profile">
                {nameMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mes permissions</CardTitle>
            <CardDescription>Définies par votre rôle. Seul le Super Admin peut les modifier.</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(permissions).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune permission spécifique.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(permissions).map(([res, actions]) => (
                  <div key={res} className="flex items-start justify-between gap-4 py-2 border-b last:border-0">
                    <div className="font-medium text-sm">{RESOURCE_LABELS[res] ?? res}</div>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {(actions as string[]).map((a) => (
                        <Badge key={a} variant="secondary" className="text-[10px]">{ACTION_LABELS[a] ?? a}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mot de passe</CardTitle>
            <CardDescription>Choisissez un mot de passe d'au moins 8 caractères.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="current-pwd">Mot de passe actuel</Label>
              <Input id="current-pwd" type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} data-testid="input-current-pwd" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new-pwd">Nouveau mot de passe</Label>
                <Input id="new-pwd" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} data-testid="input-new-pwd" />
              </div>
              <div>
                <Label htmlFor="confirm-pwd">Confirmer</Label>
                <Input id="confirm-pwd" type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} data-testid="input-confirm-pwd" />
              </div>
            </div>
            <Button onClick={submitPwd} disabled={pwdMut.isPending || !newPwd} data-testid="btn-save-password">
              {pwdMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Modifier le mot de passe
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
