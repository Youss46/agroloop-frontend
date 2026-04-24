import { customFetch } from "@/api-client";

export type BuyerState = {
  inCart: boolean;
  activeDevisId?: number;
  activeOrderId?: number;
};

export type BuyerStatesMap = Record<number, BuyerState>;

export type PendingCountsTransformateur = {
  role: "transformateur";
  cartCount: number;
  devisPending: number;
  counterProposalsDevis: number;
  counterProposalsCommandes: number;
  ordersInProgress: number;
};

export type PendingCountsProducteur = {
  role: "producteur";
  devisReceived: number;
  ordersReceived: number;
  expiringSoonDevis: number;
  expiringSoonCommandes: number;
};

export type PendingCounts = PendingCountsTransformateur | PendingCountsProducteur;

export const dashboardApi = {
  getBuyerStates: () => customFetch<BuyerStatesMap>("/api/offres/buyer-states", { method: "GET" }),
  getPendingCounts: () => customFetch<PendingCounts>("/api/dashboard/pending-counts", { method: "GET" }),
};

export type TransactionHistoryRow = {
  id: number;
  residuId: number;
  buyerId: number;
  sellerId: number;
  quantityKg: number;
  totalFcfa: number;
  status: string;
  source: "devis" | "commande" | "directe";
  devisId: number | null;
  orderId: number | null;
  orderItemId: number | null;
  createdAt: string;
  typeResidu: string;
  region: string;
  buyerName: string;
  sellerName: string;
  devisReference: string | null;
  orderReference: string | null;
  role: "acheteur" | "vendeur";
};

export const historiqueApi = {
  list: () => customFetch<TransactionHistoryRow[]>("/api/transactions/historique", { method: "GET" }),
};
