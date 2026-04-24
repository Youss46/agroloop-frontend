import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { adminApi } from "@/lib/admin-api";
import { useAuth } from "@/components/auth-provider";
import { RoleBadge } from "@/components/role-badge";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, KeyRound, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getGetMeQueryKey } from "@/api-client";

export default function AdminChangerMotDePasse() {
  const { user, token, login, isLoading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const mut = useMutation({
    mutationFn: () => adminApi.profile.changePassword({ current_password: "", new_password: newPwd }),
    onSuccess: async (data) => {
      // Backend bumps tokenVersion (revokes other sessions) and returns a fresh
      // JWT for the current one — store it before refetching /me, otherwise the
      // stale token triggers a 401 "Session expirée". Also clear the local
      // forcePasswordChange flag so ProtectedRoute does not bounce us back here.
      if (data?.token && user) {
        login(data.token, { ...user, forcePasswordChange: false } as any);
      }
      toast({ title: "Mot de passe défini", description: "Vous êtes maintenant prêt à utiliser votre compte." });
      await qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/admin");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message || "Échec", variant: "destructive" }),
  });

  const submit = () => {
    if (newPwd.length < 8) { toast({ title: "Trop court", description: "Min. 8 caractères", variant: "destructive" }); return; }
    if (newPwd !== confirmPwd) { toast({ title: "Les mots de passe ne correspondent pas", variant: "destructive" }); return; }
    mut.mutate();
  };

  if (isLoading || !user) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
            <KeyRound className="h-6 w-6 text-amber-700" />
          </div>
          <CardTitle>Bienvenue {user.name.split(" ")[0]}</CardTitle>
          <CardDescription>
            <div className="flex flex-col items-center gap-2 mt-2">
              <RoleBadge role={user.role as string} />
              <span>Avant de continuer, choisissez un mot de passe personnel.</span>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="new-pwd">Nouveau mot de passe</Label>
            <PasswordInput id="new-pwd" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} data-testid="input-new-pwd" autoFocus />
            <p className="text-xs text-muted-foreground mt-1">Min. 8 caractères.</p>
          </div>
          <div>
            <Label htmlFor="confirm-pwd">Confirmer</Label>
            <PasswordInput id="confirm-pwd" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} data-testid="input-confirm-pwd" />
          </div>
          <Button onClick={submit} disabled={mut.isPending || !newPwd} className="w-full" data-testid="btn-set-password">
            {mut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            Définir le mot de passe
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
