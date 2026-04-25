import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth-provider";
import { Layout } from "@/components/layout";
import { ProtectedRoute } from "@/components/protected-route";
import { CookieConsent } from "@/components/cookie-consent";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import { NotificationToaster } from "@/components/notification-toaster";
import { ErrorBoundary } from "@/components/error-boundary";
import { PwaInstallBanner } from "@/components/pwa-install-banner";

import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import NotFound from "@/pages/not-found";

const DashboardProducteur = lazy(() => import("@/pages/dashboard-producteur"));
const DashboardTransformateur = lazy(() => import("@/pages/dashboard-transformateur"));
const NouvelleOffre = lazy(() => import("@/pages/nouvelle-offre"));
const Marketplace = lazy(() => import("@/pages/marketplace"));
const Favoris = lazy(() => import("@/pages/favoris"));
const Marche = lazy(() => import("@/pages/marche"));
const Calculateur = lazy(() => import("@/pages/calculateur"));
const OffreDetail = lazy(() => import("@/pages/offre-detail"));
const Carte = lazy(() => import("@/pages/carte"));
const Messages = lazy(() => import("@/pages/messages"));
const Profile = lazy(() => import("@/pages/profile"));
const ProfilModifier = lazy(() => import("@/pages/profil-modifier"));
const AdminOverview = lazy(() => import("@/pages/admin"));
const AdminUsers = lazy(() => import("@/pages/admin/utilisateurs"));
const AdminOffres = lazy(() => import("@/pages/admin/offres"));
const AdminTransactions = lazy(() => import("@/pages/admin/transactions"));
const AdminAvis = lazy(() => import("@/pages/admin/avis"));
const AdminDiffusion = lazy(() => import("@/pages/admin/diffusion"));
const AdminJournal = lazy(() => import("@/pages/admin/journal"));
const AdminVerifications = lazy(() => import("@/pages/admin/verifications"));
const AdminContracts = lazy(() => import("@/pages/admin/contracts"));
const AdminAbonnements = lazy(() => import("@/pages/admin/abonnements"));
const AdminFinance = lazy(() => import("@/pages/admin/finance"));
const AdminPaiementsConfig = lazy(() => import("@/pages/admin/paiements-config"));
const AdminPlans = lazy(() => import("@/pages/admin/plans"));
const AdminParametres = lazy(() => import("@/pages/admin/parametres"));
const AdminSupport = lazy(() => import("@/pages/admin/support"));
const AdminSupportDetail = lazy(() => import("@/pages/admin/support-detail"));
const AdminSupportConfig = lazy(() => import("@/pages/admin/support-config"));
const AdminEquipe = lazy(() => import("@/pages/admin-equipe"));
const AdminProfil = lazy(() => import("@/pages/admin-profil"));
const AdminChangerMotDePasse = lazy(() => import("@/pages/admin-changer-mot-de-passe"));
const AdminAnalytics = lazy(() => import("@/pages/admin/analytics"));
const AbonnementPage = lazy(() => import("@/pages/abonnement"));
const MonComptePage = lazy(() => import("@/pages/mon-compte"));
const TransactionDetail = lazy(() => import("@/pages/transaction-detail"));
const VerifierPage = lazy(() => import("@/pages/verifier"));
const Verification = lazy(() => import("@/pages/verification"));
const NotificationsPage = lazy(() => import("@/pages/notifications"));
const SupportPage = lazy(() => import("@/pages/support"));
const PreferencesPage = lazy(() => import("@/pages/preferences"));
const MesDevisPage = lazy(() => import("@/pages/devis-mes-devis"));
const DevisRecusPage = lazy(() => import("@/pages/devis-recus"));
const DevisDetailPage = lazy(() => import("@/pages/devis-detail"));
const PanierPage = lazy(() => import("@/pages/panier"));
const MesCommandesPage = lazy(() => import("@/pages/mes-commandes"));
const CommandeDetailPage = lazy(() => import("@/pages/commande-detail"));
const CommandeConfirmationPage = lazy(() => import("@/pages/commande-confirmation"));
const CommandesRecuesPage = lazy(() => import("@/pages/commandes-recues"));
const HistoriquePage = lazy(() => import("@/pages/historique"));
const DevPortalPage = lazy(() => import("@/pages/dev-portal"));
const About = lazy(() => import("@/pages/about"));
const PolitiqueConfidentialite = lazy(() => import("@/pages/politique-confidentialite"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
        <span className="text-sm text-muted-foreground">Chargement…</span>
      </div>
    </div>
  );
}

function RouteTracker() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    trackPageView(location);
  }, [location]);
  return null;
}

function Router() {
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/dev-portal" component={DevPortalPage} />
          <Route path="/" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/marketplace" component={Marketplace} />
          <Route path="/marche" component={Marche} />
          <Route path="/calculateur" component={Calculateur} />
          <Route path="/favoris">
            <ProtectedRoute allowedRoles={["transformateur"]}>
              <Favoris />
            </ProtectedRoute>
          </Route>
          <Route path="/verifier/:reference" component={VerifierPage} />
          <Route path="/transactions/:id">
            <ProtectedRoute>
              <TransactionDetail />
            </ProtectedRoute>
          </Route>
          <Route path="/offre/:id" component={OffreDetail} />
          <Route path="/carte" component={Carte} />
          <Route path="/profil/modifier">
            <ProtectedRoute>
              <ProfilModifier />
            </ProtectedRoute>
          </Route>
          <Route path="/profil/:userId" component={Profile} />

          <Route path="/messages">
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          </Route>

          <Route path="/dashboard/producteur">
            <ProtectedRoute allowedRoles={["producteur"]}>
              <DashboardProducteur />
            </ProtectedRoute>
          </Route>

          <Route path="/dashboard/transformateur">
            <ProtectedRoute allowedRoles={["transformateur"]}>
              <DashboardTransformateur />
            </ProtectedRoute>
          </Route>

          <Route path="/admin">
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminOverview />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/utilisateurs">
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminUsers />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/offres">
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminOffres />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/transactions">
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminTransactions />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/avis">
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminAvis />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/diffusion">
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDiffusion />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/journal">
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminJournal />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/verifications">
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminVerifications />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/contracts">
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminContracts />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/abonnements">
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminAbonnements />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/finance">
            <ProtectedRoute allowedRoles={["admin"]} requirePermission={{ resource: "subscriptions", action: "view" }}>
              <AdminFinance />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/paiements-config">
            <ProtectedRoute allowedRoles={["admin"]} requirePermission={{ resource: "payment_settings", action: "view" }}>
              <AdminPaiementsConfig />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/support">
            <ProtectedRoute allowedRoles={["admin"]} requirePermission={{ resource: "support_tickets", action: "view" }}>
              <AdminSupport />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/support/configuration">
            <ProtectedRoute allowedRoles={["admin"]} requirePermission={{ resource: "support_tickets", action: "configure" }}>
              <AdminSupportConfig />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/support/:id">
            <ProtectedRoute allowedRoles={["admin"]} requirePermission={{ resource: "support_tickets", action: "view" }}>
              <AdminSupportDetail />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/plans">
            <ProtectedRoute allowedRoles={["admin"]} requirePermission={{ resource: "plans", action: "view" }}>
              <AdminPlans />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/parametres">
            <ProtectedRoute allowedRoles={["admin"]} requirePermission={{ resource: "settings", action: "view" }}>
              <AdminParametres />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/analytics">
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminAnalytics />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/equipe">
            <ProtectedRoute allowedRoles={["admin"]} requirePermission={{ resource: "admin_accounts", action: "view" }}>
              <AdminEquipe />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/profil">
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminProfil />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/changer-mot-de-passe">
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminChangerMotDePasse />
            </ProtectedRoute>
          </Route>

          <Route path="/abonnement" component={AbonnementPage} />
          <Route path="/mon-compte">
            <ProtectedRoute>
              <MonComptePage />
            </ProtectedRoute>
          </Route>

          <Route path="/verification">
            <ProtectedRoute>
              <Verification />
            </ProtectedRoute>
          </Route>

          <Route path="/notifications">
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          </Route>

          <Route path="/preferences">
            <ProtectedRoute>
              <PreferencesPage />
            </ProtectedRoute>
          </Route>

          <Route path="/support">
            <ProtectedRoute>
              <SupportPage />
            </ProtectedRoute>
          </Route>

          <Route path="/devis/mes-devis">
            <ProtectedRoute allowedRoles={["transformateur"]}>
              <MesDevisPage />
            </ProtectedRoute>
          </Route>
          <Route path="/devis/recus">
            <ProtectedRoute allowedRoles={["producteur"]}>
              <DevisRecusPage />
            </ProtectedRoute>
          </Route>
          <Route path="/devis/:id">
            <ProtectedRoute>
              <DevisDetailPage />
            </ProtectedRoute>
          </Route>

          <Route path="/panier">
            <ProtectedRoute allowedRoles={["transformateur"]}>
              <PanierPage />
            </ProtectedRoute>
          </Route>
          <Route path="/commandes">
            <ProtectedRoute allowedRoles={["transformateur"]}>
              <MesCommandesPage />
            </ProtectedRoute>
          </Route>
          <Route path="/commandes/recues">
            <ProtectedRoute allowedRoles={["producteur"]}>
              <CommandesRecuesPage />
            </ProtectedRoute>
          </Route>
          <Route path="/commandes/confirmation/:id">
            <ProtectedRoute allowedRoles={["transformateur"]}>
              <CommandeConfirmationPage />
            </ProtectedRoute>
          </Route>
          <Route path="/commandes/:id">
            <ProtectedRoute allowedRoles={["transformateur"]}>
              <CommandeDetailPage />
            </ProtectedRoute>
          </Route>
          <Route path="/historique">
            <ProtectedRoute allowedRoles={["producteur", "transformateur"]}>
              <HistoriquePage />
            </ProtectedRoute>
          </Route>

          <Route path="/offres/nouvelle">
            <ProtectedRoute allowedRoles={["producteur"]}>
              <NouvelleOffre />
            </ProtectedRoute>
          </Route>

          <Route path="/about"><About /></Route>
          <Route path="/politique-confidentialite"><PolitiqueConfidentialite /></Route>
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <RouteTracker />
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
            <NotificationToaster />
            <Toaster />
            <CookieConsent />
            <PwaInstallBanner />
          </AuthProvider>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
