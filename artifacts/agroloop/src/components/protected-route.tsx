import { ReactNode } from "react";
import { useAuth } from "./auth-provider";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PermissionDenied } from "./permission-denied";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
  requirePermission?: { resource: string; action: string };
}

const ADMIN_ROLES = new Set([
  "admin",
  "super_admin",
  "moderateur",
  "support",
  "finance",
  "commercial",
]);

export function ProtectedRoute({ children, allowedRoles, requirePermission }: ProtectedRouteProps) {
  const { user, isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;

  // Force password change for fresh-invite admins
  if ((user as any).forcePasswordChange) {
    if (typeof window !== "undefined" && window.location.pathname !== "/admin/changer-mot-de-passe") {
      return <Redirect to="/admin/changer-mot-de-passe" />;
    }
  }

  if (allowedRoles && allowedRoles.length) {
    const expanded = new Set<string>(allowedRoles);
    // If "admin" is allowed, expand to all admin sub-roles.
    if (expanded.has("admin")) {
      for (const r of ADMIN_ROLES) expanded.add(r);
    }
    if (!expanded.has(user.role as string)) {
      const role = user.role as string;
      const fallback =
        ADMIN_ROLES.has(role)
          ? "/admin"
          : role === "producteur" || role === "transformateur"
          ? `/dashboard/${role}`
          : "/";
      return <Redirect to={fallback} />;
    }
  }

  if (requirePermission && !hasPermission(requirePermission.resource, requirePermission.action)) {
    return <PermissionDenied resource={requirePermission.resource} action={requirePermission.action} />;
  }

  return <>{children}</>;
}
