import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { RoleBadge } from "@/components/role-badge";

export function PermissionDenied({ resource, action }: { resource?: string; action?: string }) {
  const { user } = useAuth();
  return (
    <div className="container max-w-lg py-16">
      <div className="rounded-xl border bg-card p-8 text-center space-y-4" data-testid="permission-denied">
        <div className="mx-auto h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
          <Lock className="h-7 w-7 text-red-600" />
        </div>
        <h1 className="text-2xl font-semibold">Accès refusé</h1>
        <p className="text-muted-foreground">
          Vous n'avez pas les permissions nécessaires pour accéder à cette section.
        </p>
        {user && (
          <div className="flex flex-col items-center gap-2 text-sm">
            <span className="text-muted-foreground">Votre rôle :</span>
            <RoleBadge role={user.role as string} />
            {resource && action && (
              <span className="text-xs text-muted-foreground">
                Permission requise : <code className="bg-muted px-1 py-0.5 rounded">{resource}.{action}</code>
              </span>
            )}
          </div>
        )}
        <div className="pt-2">
          <Link href="/admin">
            <Button variant="outline" data-testid="btn-back-dashboard">Retour au tableau de bord</Button>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          Si vous pensez que c'est une erreur, contactez le Super Administrateur.
        </p>
      </div>
    </div>
  );
}
