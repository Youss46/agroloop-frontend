import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth-provider";
import { Layout } from "@/components/layout";
import { ProtectedRoute } from "@/components/protected-route";
import { CookieConsent } from "@/components/cookie-consent";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { initAnalytics, trackPageView } from "@/lib/analytics";

import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import DashboardProducteur from "@/pages/dashboard-producteur";
import DashboardTransformateur from "@/pages/dashboard-transformateur";
import NouvelleOffre from "@/pages/nouvelle-offre";
import Marketplace from "@/pages/marketplace";
import Favoris from "@/pages/favoris";
import Marche from "@/pages/marche";
import Calculateur from "@/pages/calculateur";
import OffreDetail from "@/pages/offre-detail";
import Carte from "@/pages/carte";
import Messages from "@/pages/messages";
import Profile from "@/pages/profile";
import ProfilModifier from "@/pages/profil-modifier";
import NotFound from "@/pages/not-found";
import About from "@/pages/about";
import PolitiqueConfidentialite from "@/pages/politique-confidentialite";
import AdminOverview from "@/pages/admin";
import AdminUsers from "@/pages/admin/utilisateurs";
import AdminOffres from "@/pages/admin/offres";
import AdminTransactions from "@/pages/admin/transactions";
import AdminAvis from "@/pages/admin/avis";
import AdminDiffusion from "@/pages/admin/diffusion";
import AdminJournal from "@/pages/admin/journal";
import AdminVerifications from "@/pages/admin/verifications";
import AdminContracts from "@/pages/admin/contracts";
import AdminAbonnements from "@/pages/admin/abonnements";
import AdminFinance from "@/pages/admin/finance";
import AdminPaiementsConfig from "@/pages/admin/paiements-config";
import AdminPlans from "@/pages/admin/plans";
import AdminParametres from "@/pages/admin/parametres";
import AdminSupport from "@/pages/admin/support";
import AdminSupportDetail from "@/pages/admin/support-detail";
import AdminSupportConfig from "@/pages/admin/support-config";
import AdminEquipe from "@/pages/admin-equipe";
import AdminProfil from "@/pages/admin-profil";
import AdminChangerMotDePasse from "@/pages/admin-changer-mot-de-passe";
import AdminAnalytics from "@/pages/admin/analytics";
import AbonnementPage from "@/pages/abonnement";
import MonComptePage from "@/pages/mon-compte";
import TransactionDetail from "@/pages/transaction-detail";
import VerifierPage from "@/pages/verifier";
import Verification from "@/pages/verification";
import NotificationsPage from "@/pages/notifications";
import SupportPage from "@/pages/support";
import PreferencesPage from "@/pages/preferences";
import MesDevisPage from "@/pages/devis-mes-devis";
import DevisRecusPage from "@/pages/devis-recus";
import DevisDetailPage from "@/pages/devis-detail";
import PanierPage from "@/pages/panier";
import MesCommandesPage from "@/pages/mes-commandes";
import CommandeDetailPage from "@/pages/commande-detail";
import CommandeConfirmationPage from "@/pages/commande-confirmation";
import CommandesRecuesPage from "@/pages/commandes-recues";
import HistoriquePage from "@/pages/historique";
import DevPortalPage from "@/pages/dev-portal";
import { NotificationToaster } from "@/components/notification-toaster";
import { ErrorBoundary } from "@/components/error-boundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function RouteTracker() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    trackPageView(location);
    if (typeof window.gtag === "function") {
      window.gtag("event", "page_view", {
        page_path: location,
        page_title: document.title,
        page_location: window.location.href,
      });
    }
  }, [location]);
  return null;
}

function Router() {
  return (
    <Layout>
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

        <Route path="/about" component={About} />
        <Route path="/politique-confidentialite" component={PolitiqueConfidentialite} />
        <Route component={NotFound} />
      </Switch>
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
