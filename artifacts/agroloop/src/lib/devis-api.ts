import { customFetch } from "@workspace/api-client-react";

export type DevisStatus =
  | "en_attente"
  | "accepté"
  | "refusé"
  | "contre_proposé"
  | "contre_proposé_accepté"
  | "contre_proposé_refusé"
  | "expiré";

export type Devis = {
  id: number;
  offre_id: number;
  transformateur_id: number;
  producteur_id: number;
  reference: string;
  status: DevisStatus;
  quantity_kg: number;
  price_fcfa: number;
  total_fcfa: number;
  note: string | null;
  response_note: string | null;
  responded_at: string | null;
  counter_quantity_kg: number | null;
  counter_price_fcfa: number | null;
  counter_total_fcfa: number | null;
  counter_note: string | null;
  counter_response_note: string | null;
  counter_responded_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type DevisListItem = Devis & {
  offre: {
    id: number;
    type_residu: string;
    region: string;
    seller_price_fcfa: number;
    quantity_kg: number;
    status: string | null;
  };
  other_party: {
    id: number;
    name: string;
    verification_level: number;
  };
};

export type DevisDetail = Devis & {
  offre: {
    id: number;
    type_residu: string;
    region: string;
    description: string | null;
    seller_price_fcfa: number;
    quantity_kg: number;
    status: string | null;
  };
  transformateur: {
    id: number;
    name: string;
    phone: string | null;
    verificationLevel: number;
  } | null;
  producteur: {
    id: number;
    name: string;
    phone: string | null;
    verificationLevel: number;
  } | null;
};

export const devisApi = {
  create: (body: { offre_id: number; quantity_kg: number; price_fcfa: number; note?: string }) =>
    customFetch<Devis>("/api/devis", { method: "POST", body: JSON.stringify(body) }),

  mesDevis: (status?: string) =>
    customFetch<DevisListItem[]>(`/api/devis/mes-devis${status && status !== "tous" ? `?status=${encodeURIComponent(status)}` : ""}`),

  recus: (status?: string) =>
    customFetch<DevisListItem[]>(`/api/devis/recus${status && status !== "tous" ? `?status=${encodeURIComponent(status)}` : ""}`),

  detail: (id: number) => customFetch<DevisDetail>(`/api/devis/${id}`),

  accepter: (id: number) =>
    customFetch<Devis>(`/api/devis/${id}/accepter`, { method: "PUT" }),

  refuser: (id: number, response_note: string) =>
    customFetch<Devis>(`/api/devis/${id}/refuser`, {
      method: "PUT", body: JSON.stringify({ response_note }),
    }),

  contreProposer: (id: number, body: { counter_quantity_kg: number; counter_price_fcfa: number; counter_note?: string }) =>
    customFetch<Devis>(`/api/devis/${id}/contre-proposer`, {
      method: "PUT", body: JSON.stringify(body),
    }),

  accepterContreProposition: (id: number) =>
    customFetch<Devis>(`/api/devis/${id}/contre-proposer/accepter`, { method: "PUT" }),

  refuserContreProposition: (id: number, counter_response_note: string) =>
    customFetch<Devis>(`/api/devis/${id}/contre-proposer/refuser`, {
      method: "PUT", body: JSON.stringify({ counter_response_note }),
    }),

  activeForOffre: (offreId: number) =>
    customFetch<{ active_devis: { id: number; status: DevisStatus } | null }>(`/api/devis/offre/${offreId}/active`),
};

// ─── UI helpers ────────────────────────────────────────────────────────────

export function formatFcfa(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

export function devisStatusLabel(s: DevisStatus): { label: string; color: string; emoji: string } {
  switch (s) {
    case "en_attente": return { label: "En attente", color: "bg-amber-100 text-amber-800 border-amber-300", emoji: "⏳" };
    case "accepté": return { label: "Accepté", color: "bg-emerald-100 text-emerald-800 border-emerald-300", emoji: "✅" };
    case "refusé": return { label: "Refusé", color: "bg-red-100 text-red-800 border-red-300", emoji: "❌" };
    case "contre_proposé": return { label: "Contre-proposé", color: "bg-blue-100 text-blue-800 border-blue-300", emoji: "🔄" };
    case "contre_proposé_accepté": return { label: "Contre-prop. acceptée", color: "bg-emerald-100 text-emerald-800 border-emerald-300", emoji: "✅" };
    case "contre_proposé_refusé": return { label: "Contre-prop. refusée", color: "bg-red-100 text-red-800 border-red-300", emoji: "❌" };
    case "expiré": return { label: "Expiré", color: "bg-gray-100 text-gray-700 border-gray-300", emoji: "⏰" };
  }
}

export function priceFeedback(proposedPrice: number, sellerPrice: number):
  { color: string; label: string } {
  if (sellerPrice <= 0) return { color: "text-gray-600", label: "" };
  const ratio = proposedPrice / sellerPrice;
  if (ratio >= 1) return { color: "text-emerald-600", label: "Bonne offre ✓" };
  if (ratio >= 0.8) return { color: "text-orange-600", label: "Légèrement en dessous" };
  return { color: "text-red-600", label: "Prix très bas" };
}

export function countdownString(expiresAt: string): { text: string; color: string } {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { text: "Expiré", color: "text-gray-500" };
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  const color = hours < 3 ? "text-red-600" : hours < 12 ? "text-orange-600" : "text-emerald-600";
  if (hours > 0) return { text: `Expire dans ${hours}h ${minutes}min`, color };
  return { text: `Expire dans ${minutes}min`, color };
}
