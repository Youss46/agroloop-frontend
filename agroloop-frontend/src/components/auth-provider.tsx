import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from "react";
import { useGetMe, getGetMeQueryKey } from "@/api-client";
import type { User } from "@/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

export type AdminRoleName = "super_admin" | "moderateur" | "support" | "finance" | "commercial" | "admin";

export interface AdminUserExtras {
  adminRole?: { name: AdminRoleName; label: string } | null;
  permissions?: Record<string, string[]> | null;
  isAdminActive?: boolean;
  forcePasswordChange?: boolean;
  lastLogin?: string | null;
}

export type AuthUser = User & AdminUserExtras;

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isLoading: boolean;
  hasPermission: (resource: string, action: string) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

const AUTH_ADMIN_ROLES = new Set([
  "admin",
  "super_admin",
  "moderateur",
  "support",
  "finance",
  "commercial",
]);

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("agroloop_token");
    }
    return null;
  });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: me, isLoading: isMeLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!token,
      retry: false,
    },
  });

  useEffect(() => {
    if (me) setUser(me as AuthUser);
  }, [me]);

  const login = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem("agroloop_token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    const t = localStorage.getItem("agroloop_token");
    if (t) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => { /* best-effort: still clear locally */ });
    }
    localStorage.removeItem("agroloop_token");
    setToken(null);
    setUser(null);
    queryClient.clear();
    setLocation("/login");
  };

  const ctx = useMemo<AuthContextType>(() => {
    const u = (user ?? (me as AuthUser | undefined) ?? null);
    const role = u?.role as string | undefined;
    const isAdmin = !!role && AUTH_ADMIN_ROLES.has(role);
    const isSuperAdmin = role === "super_admin" || role === "admin";
    const perms = u?.permissions ?? {};
    const hasPermission = (resource: string, action: string): boolean => {
      if (!isAdmin) return false;
      if (role === "admin") return true; // legacy full-admin compat
      const list = perms[resource];
      return Array.isArray(list) && list.includes(action);
    };
    return {
      user: u,
      token,
      login,
      logout,
      isLoading: !!token && isMeLoading,
      hasPermission,
      isAdmin,
      isSuperAdmin,
    };
  }, [user, me, token, isMeLoading]);

  return <AuthContext.Provider value={ctx}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function usePermission(resource: string, action: string): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(resource, action);
}
