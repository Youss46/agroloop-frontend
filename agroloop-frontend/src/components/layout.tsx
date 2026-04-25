import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "./auth-provider";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  Menu,
  Map as MapIcon,
  ShoppingCart,
  LayoutDashboard,
  MessageSquare,
  Shield,
  BadgeCheck,
  Bell,
  Settings,
  FileText,
  Package,
  History,
  ChevronDown,
  LifeBuoy,
  Heart,
  BarChart3,
  Calculator,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VerificationBadge } from "@/components/verification-badge";
import { NotificationBell } from "@/components/notification-bell";
import { CartBadge } from "@/components/cart-badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  useListConversations,
  getListConversationsQueryKey,
} from "@/api-client";
import { connectSocket, disconnectSocket } from "@/lib/socket";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, token, logout } = useAuth();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Admin pages render their own AdminLayout (with dedicated top bar + sidebar).
  // We compute this here but apply the early return AFTER all hooks below to
  // preserve hook-call ordering across renders.
  const isAdminRoute = location === "/admin" || location.startsWith("/admin/");

  // Auto-close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const { data: conversations } = useListConversations({
    query: {
      queryKey: getListConversationsQueryKey(),
      enabled: !!token,
      refetchInterval: 30000,
    },
  });

  const totalUnread =
    conversations?.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0) ?? 0;

  // Maintain global socket connection for real-time unread updates
  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }
    const s = connectSocket();
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    };
    s.on("conversation_updated", handler);
    s.on("new_message", handler);
    return () => {
      s.off("conversation_updated", handler);
      s.off("new_message", handler);
    };
  }, [token, queryClient]);

  const role = user?.role as string | undefined;
  const getDashboardLink = () => {
    if (!user) return "/login";
    if (role === "admin") return "/admin";
    return role === "producteur"
      ? "/dashboard/producteur"
      : "/dashboard/transformateur";
  };

  const isAdmin = role === "admin";

  const navLinks = [
    { href: "/marketplace", label: "Marketplace", icon: ShoppingCart },
    { href: "/marche", label: "Marché", icon: BarChart3 },
    { href: "/carte", label: "Carte", icon: MapIcon },
  ];

  if (isAdminRoute) {
    return <div className="min-h-[100dvh] flex flex-col">{children}</div>;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center" data-testid="link-home-logo">
              <img
                src="/brand/agroloop-logo-light.png"
                alt="AgroLoopCI"
                className="h-10 w-auto"
              />
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors hover:text-primary ${location === link.href ? "text-primary" : "text-muted-foreground"}`}
                >
                  <div className="flex items-center gap-2">
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </div>
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`text-sm font-medium transition-colors hover:text-primary ${location.startsWith("/admin") ? "text-primary" : "text-muted-foreground"}`}
                  data-testid="link-admin"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Admin
                    <span className="bg-amber-500/15 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      ADMIN
                    </span>
                  </div>
                </Link>
              )}
              {user && !isAdmin && (
                <Link
                  href="/verification"
                  className={`text-sm font-medium transition-colors hover:text-primary ${location === "/verification" ? "text-primary" : "text-muted-foreground"}`}
                  data-testid="link-verification"
                >
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4" />
                    Vérification
                    <VerificationBadge level={(user as any).verificationLevel ?? 0} size="sm" />
                  </div>
                </Link>
              )}
              {user && (
                <Link
                  href="/messages"
                  className={`text-sm font-medium transition-colors hover:text-primary ${location === "/messages" ? "text-primary" : "text-muted-foreground"}`}
                  data-testid="link-messages"
                >
                  <div className="flex items-center gap-2 relative">
                    <MessageSquare className="h-4 w-4" />
                    Messages
                    {totalUnread > 0 && (
                      <span
                        className="absolute -top-1 -right-3 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center"
                        data-testid="badge-unread-nav"
                      >
                        {totalUnread > 9 ? "9+" : totalUnread}
                      </span>
                    )}
                  </div>
                </Link>
              )}
              {user?.role === "transformateur" && <FavoritesNavLink />}
              {user?.role === "transformateur" && <CartBadge />}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden md:block">
                <NotificationBell />
              </div>
            )}
            <div className="hidden md:flex items-center gap-4">
              {user ? (
                <>
                  <Link href={getDashboardLink()}>
                    <Button variant="ghost" className="gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      Tableau de bord
                    </Button>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="gap-2" data-testid="button-user-menu">
                        Mon compte
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {role === "transformateur" && (
                        <>
                          <DropdownMenuItem asChild>
                            <Link href="/commandes" data-testid="menu-mes-commandes">
                              <Package className="h-4 w-4 mr-2" /> Mes commandes
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/devis/mes-devis" data-testid="menu-mes-devis">
                              <FileText className="h-4 w-4 mr-2" /> Mes devis
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                      {role === "producteur" && (
                        <>
                          <DropdownMenuItem asChild>
                            <Link href="/commandes/recues" data-testid="menu-commandes-recues">
                              <Package className="h-4 w-4 mr-2" /> Commandes reçues
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/devis/recus" data-testid="menu-devis-recus">
                              <FileText className="h-4 w-4 mr-2" /> Devis reçus
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                      {(role === "transformateur" || role === "producteur") && (
                        <>
                          <DropdownMenuItem asChild>
                            <Link href="/historique" data-testid="menu-historique">
                              <History className="h-4 w-4 mr-2" /> Historique
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem asChild>
                        <Link href="/preferences" data-testid="menu-preferences">
                          <Settings className="h-4 w-4 mr-2" /> Préférences
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/support" data-testid="menu-support">
                          <LifeBuoy className="h-4 w-4 mr-2" /> Aide et support
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={logout} data-testid="menu-logout">
                        <LogOut className="h-4 w-4 mr-2" /> Déconnexion
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost">Connexion</Button>
                  </Link>
                  <Link href="/register">
                    <Button>S'inscrire</Button>
                  </Link>
                </>
              )}
            </div>

            {user && (
              <div className="md:hidden">
                <NotificationBell />
              </div>
            )}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden relative">
                  <Menu className="h-5 w-5" />
                  {user && totalUnread > 0 && (
                    <span className="absolute top-1 right-1 bg-red-500 rounded-full h-2 w-2" />
                  )}
                  <span className="sr-only">Menu principal</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[300px] sm:w-[400px]"
                onClick={(e) => {
                  // Close drawer when any link/button inside is clicked.
                  // We bubble-listen here so we don't have to wire onClick on every item individually.
                  const target = e.target as HTMLElement;
                  if (target.closest("a, button")) {
                    setMobileMenuOpen(false);
                  }
                }}
              >
                <div className="flex flex-col gap-6 py-6">
                  <Link href="/" className="flex items-center">
                    <img
                      src="/brand/agroloop-logo-light.png"
                      alt="AgroLoopCI"
                      className="h-10 w-auto"
                    />
                  </Link>

                  <nav className="flex flex-col gap-4">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`text-sm font-medium transition-colors hover:text-primary ${location === link.href ? "text-primary" : "text-muted-foreground"}`}
                      >
                        <div className="flex items-center gap-2">
                          <link.icon className="h-4 w-4" />
                          {link.label}
                        </div>
                      </Link>
                    ))}
                    {isAdmin && (
                      <Link
                        href="/admin"
                        className={`text-sm font-medium transition-colors hover:text-primary ${location.startsWith("/admin") ? "text-primary" : "text-muted-foreground"}`}
                      >
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Admin
                        </div>
                      </Link>
                    )}
                    {user && !isAdmin && (
                      <Link
                        href="/verification"
                        className={`text-sm font-medium transition-colors hover:text-primary ${location === "/verification" ? "text-primary" : "text-muted-foreground"}`}
                      >
                        <div className="flex items-center gap-2">
                          <BadgeCheck className="h-4 w-4" />
                          Vérification
                          <VerificationBadge level={(user as any).verificationLevel ?? 0} size="sm" />
                        </div>
                      </Link>
                    )}
                    {user && (
                      <Link
                        href="/notifications"
                        className={`text-sm font-medium transition-colors hover:text-primary ${location === "/notifications" ? "text-primary" : "text-muted-foreground"}`}
                      >
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4" />
                          Notifications
                        </div>
                      </Link>
                    )}
                    {user && (
                      <Link
                        href="/preferences"
                        className={`text-sm font-medium transition-colors hover:text-primary ${location === "/preferences" ? "text-primary" : "text-muted-foreground"}`}
                      >
                        <div className="flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          Préférences
                        </div>
                      </Link>
                    )}
                    {user && (
                      <Link
                        href="/messages"
                        className={`text-sm font-medium transition-colors hover:text-primary ${location === "/messages" ? "text-primary" : "text-muted-foreground"}`}
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Messages
                          {totalUnread > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                              {totalUnread > 9 ? "9+" : totalUnread}
                            </span>
                          )}
                        </div>
                      </Link>
                    )}
                    {user?.role === "transformateur" && <CartBadge mobile />}
                    {role === "transformateur" && (
                      <>
                        <Link href="/commandes" className={`text-sm font-medium transition-colors hover:text-primary ${location.startsWith("/commandes") && !location.includes("recues") ? "text-primary" : "text-muted-foreground"}`}>
                          <div className="flex items-center gap-2"><Package className="h-4 w-4" />Mes commandes</div>
                        </Link>
                        <Link href="/devis/mes-devis" className={`text-sm font-medium transition-colors hover:text-primary ${location.startsWith("/devis/mes-devis") ? "text-primary" : "text-muted-foreground"}`}>
                          <div className="flex items-center gap-2"><FileText className="h-4 w-4" />Mes devis</div>
                        </Link>
                      </>
                    )}
                    {role === "producteur" && (
                      <>
                        <Link href="/commandes/recues" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/commandes/recues" ? "text-primary" : "text-muted-foreground"}`}>
                          <div className="flex items-center gap-2"><Package className="h-4 w-4" />Commandes reçues</div>
                        </Link>
                        <Link href="/devis/recus" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/devis/recus" ? "text-primary" : "text-muted-foreground"}`}>
                          <div className="flex items-center gap-2"><FileText className="h-4 w-4" />Devis reçus</div>
                        </Link>
                      </>
                    )}
                    {(role === "transformateur" || role === "producteur") && (
                      <Link href="/historique" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/historique" ? "text-primary" : "text-muted-foreground"}`}>
                        <div className="flex items-center gap-2"><History className="h-4 w-4" />Historique</div>
                      </Link>
                    )}
                  </nav>

                  <div className="h-px bg-border" />

                  <div className="flex flex-col gap-3">
                    {user ? (
                      <>
                        <Link href={getDashboardLink()}>
                          <Button variant="outline" className="w-full justify-start gap-2">
                            <LayoutDashboard className="h-4 w-4" />
                            Tableau de bord
                          </Button>
                        </Link>
                        <Link href="/support" data-testid="mobile-menu-support">
                          <Button variant="ghost" className="w-full justify-start gap-2">
                            <LifeBuoy className="h-4 w-4" />
                            Aide et support
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          onClick={logout}
                          className="w-full justify-start gap-2"
                        >
                          <LogOut className="h-4 w-4" />
                          Déconnexion
                        </Button>
                      </>
                    ) : (
                      <>
                        <Link href="/login">
                          <Button variant="outline" className="w-full">
                            Connexion
                          </Button>
                        </Link>
                        <Link href="/register">
                          <Button className="w-full">S'inscrire</Button>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">{children}</main>

      <footer className="border-t py-10 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center">
              <img
                src="/brand/agroloop-logo-light.png"
                alt="AgroLoopCI"
                className="h-7 w-auto"
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Valoriser les résidus agricoles, ensemble. 🌿
            </p>
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-primary transition-colors">
                Accueil
              </Link>
              <Link href="/marketplace" className="hover:text-primary transition-colors">
                Marketplace
              </Link>
              <Link href="/carte" className="hover:text-primary transition-colors">
                Carte
              </Link>
              <Link href="/about" className="hover:text-primary transition-colors">
                À propos
              </Link>
              <Link href="/politique-confidentialite" className="hover:text-primary transition-colors">
                Confidentialité
              </Link>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} AgroLoopCI — Tous droits réservés
          </div>
        </div>
      </footer>
    </div>
  );
}

function FavoritesNavLink() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["favorites-count"],
    queryFn: () => import("@/lib/favorites-api").then(m => m.favoritesApi.count()),
    enabled: !!user && user.role === "transformateur",
    refetchInterval: 60_000,
  });
  const count = data?.count ?? 0;
  return (
    <Link
      href="/favoris"
      className={`text-sm font-medium transition-colors hover:text-primary ${location === "/favoris" ? "text-primary" : "text-muted-foreground"}`}
      data-testid="link-favoris"
    >
      <div className="flex items-center gap-2 relative">
        <Heart className="h-4 w-4" />
        Favoris
        {count > 0 && (
          <span
            className="absolute -top-1 -right-3 bg-[#ef4444] text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center"
            data-testid="badge-favorites-count"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </div>
    </Link>
  );
}
