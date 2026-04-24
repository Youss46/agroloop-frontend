import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Package,
  Receipt,
  Star,
  Megaphone,
  ScrollText,
  Settings,
  Banknote,
  Tag,
  CreditCard,
  UserCog,
  TrendingUp,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Headphones,
  BadgeCheck,
  ExternalLink,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { RoleBadge } from "@/components/role-badge";
import { NotificationBell } from "@/components/notification-bell";
import { customFetch } from "@/api-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type BadgeKey = "verifications_pending" | "subscriptions_pending" | "support_open";

type Item = {
  href: string;
  label: string;
  icon: any;
  exact?: boolean;
  requires?: { resource: string; action: string };
  badge?: BadgeKey;
};

type Section = { label: string; items: Item[] };

const sections: Section[] = [
  {
    label: "Gestion",
    items: [
      { href: "/admin", label: "Vue générale", icon: LayoutDashboard, exact: true, requires: { resource: "reports", action: "view" } },
      { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users, requires: { resource: "users", action: "view" } },
      { href: "/admin/verifications", label: "Vérifications", icon: BadgeCheck, requires: { resource: "verifications", action: "view" }, badge: "verifications_pending" },
      { href: "/admin/offres", label: "Offres", icon: Package, requires: { resource: "offres", action: "view" } },
      { href: "/admin/transactions", label: "Transactions", icon: Receipt, requires: { resource: "transactions", action: "view" } },
      { href: "/admin/contracts", label: "Bons de commande", icon: Receipt, requires: { resource: "contracts", action: "view" } },
    ],
  },
  {
    label: "Monétisation",
    items: [
      { href: "/admin/abonnements", label: "Abonnements", icon: CreditCard, requires: { resource: "subscriptions", action: "view" }, badge: "subscriptions_pending" },
      { href: "/admin/finance", label: "Finance", icon: TrendingUp, requires: { resource: "subscriptions", action: "view" } },
      { href: "/admin/paiements-config", label: "Moyens de paiement", icon: Banknote, requires: { resource: "payment_settings", action: "view" } },
      { href: "/admin/plans", label: "Tarifs & Plans", icon: Tag, requires: { resource: "plans", action: "view" } },
    ],
  },
  {
    label: "Communauté",
    items: [
      { href: "/admin/avis", label: "Avis & Modération", icon: Star, requires: { resource: "ratings", action: "view" }, badge: "moderation_total" },
      { href: "/admin/support", label: "Support", icon: Headphones, requires: { resource: "support_tickets", action: "view" }, badge: "support_open" },
      { href: "/admin/diffusion", label: "Diffusion", icon: Megaphone, requires: { resource: "broadcast", action: "send" } },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
      { href: "/admin/equipe", label: "Équipe admin", icon: UserCog, requires: { resource: "admin_accounts", action: "view" } },
      { href: "/admin/journal", label: "Journal d'audit", icon: ScrollText, requires: { resource: "audit_logs", action: "view" } },
      { href: "/admin/parametres", label: "Paramètres", icon: Settings, requires: { resource: "settings", action: "view" } },
    ],
  },
];

type SidebarBadges = {
  verifications_pending: number;
  subscriptions_pending: number;
  support_open: number;
  ratings_flagged: number;
  offers_flagged: number;
  moderation_total: number;
};

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, hasPermission, logout, token } = useAuth();

  const { data: badges } = useQuery<SidebarBadges>({
    queryKey: ["admin-sidebar-badges"],
    queryFn: () => customFetch<SidebarBadges>("/api/admin/sidebar-badges"),
    enabled: !!token,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const initials = user?.name?.split(" ").map((p) => p[0]).slice(0, 2).join("") ?? "AD";

  const visibleSections = sections
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => !it.requires || hasPermission(it.requires.resource, it.requires.action)),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="min-h-[100dvh] bg-muted/20 flex flex-col">
      {/* ── ADMIN TOP BAR ──────────────────────────────────────── */}
      <header className="sticky top-0 z-40 h-14 bg-white border-b flex items-center px-4 md:px-6 gap-4">
        <Link href="/admin" className="flex items-center gap-2 shrink-0" data-testid="admin-topbar-logo">
          <img src="/brand/agroloop-logo-light.png" alt="AgroLoopCI" className="h-8 w-auto" loading="eager" />
          <span className="hidden sm:inline text-sm text-muted-foreground border-l pl-2 ml-1">Console Admin</span>
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {user && <NotificationBell />}
          <span className="hidden sm:inline w-px h-6 bg-border mx-1" />
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-left transition"
                  data-testid="admin-user-menu"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                    {initials}
                  </div>
                  <div className="hidden md:block min-w-0">
                    <div className="text-sm font-medium leading-tight truncate max-w-[160px]">{user.name}</div>
                    <div className="leading-tight"><RoleBadge role={user.role as string} /></div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/admin/profil"><span className="flex items-center gap-2"><UserIcon className="h-4 w-4" /> Mon profil admin</span></Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" /> Voir le site
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-700" data-testid="admin-logout">
                  <LogOut className="h-4 w-4 mr-2" /> Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* ── BODY ─────────────────────────────────────────────── */}
      <div className="flex-1 container py-6 grid md:grid-cols-[240px_1fr] gap-6">
        <aside className="md:sticky md:top-20 self-start">
          <nav className="flex flex-col gap-4">
            {visibleSections.map((section) => (
              <div key={section.label}>
                <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </div>
                <div className="flex flex-col gap-0.5">
                  {section.items.map((item) => {
                    const active = item.exact ? location === item.href : location === item.href || location.startsWith(item.href + "/");
                    const badgeValue = item.badge ? badges?.[item.badge] ?? 0 : 0;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                          active
                            ? "bg-green-600 text-white font-medium hover:bg-green-700"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                        data-testid={`admin-nav-${item.href.split("/").pop() || "overview"}`}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {badgeValue > 0 && (
                          <span
                            className={cn(
                              "text-[10px] font-bold rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center shrink-0",
                              active ? "bg-white text-red-600" : "bg-red-500 text-white",
                            )}
                            data-testid={`badge-${item.badge}`}
                          >
                            {badgeValue > 99 ? "99+" : badgeValue}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
